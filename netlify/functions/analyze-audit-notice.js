// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Notice Analysis Function
// Purpose: Netlify serverless function for audit-only analysis
// Rejects all non-audit notices

const auditIntelligence = require('./irs-audit-intelligence/index');
const { getSupabaseAdmin } = require('./_supabase.js');

let OpenAI, pdfParse, mammoth;

try {
  OpenAI = require("openai");
  pdfParse = require("pdf-parse");
  mammoth = require("mammoth");
} catch (importError) {
  console.error("Import error:", importError);
}

exports.handler = async (event) => {
  console.log('=== ANALYZE AUDIT NOTICE FUNCTION START ===');
  console.log('HTTP Method:', event.httpMethod);
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const parsedBody = JSON.parse(event.body || "{}");
    const { 
      text, 
      fileUrl, 
      userEmail = null, 
      stripeSessionId = null,
      noticeDate = null
    } = parsedBody;
    
    let letterText = text || "";
    
    // Extract text from file if provided
    if (fileUrl) {
      try {
        if (fileUrl.startsWith('data:')) {
          const base64Data = fileUrl.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          
          if (fileUrl.includes('application/pdf')) {
            const parsed = await pdfParse(buffer);
            letterText += "\n\n" + parsed.text;
          } else if (fileUrl.includes('application/vnd.openxmlformats') || fileUrl.includes('application/msword')) {
            const { value } = await mammoth.extractRawText({ buffer: buffer });
            letterText += "\n\n" + value;
          }
        }
      } catch (fileError) {
        console.error("File processing error:", fileError);
        letterText += "\n\n[File processing error - please paste text manually]";
      }
    }

    if (!letterText.trim()) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: "No text provided or extracted from files." 
        })
      };
    }

    // ANALYZE USING AUDIT INTELLIGENCE SYSTEM
    console.log('Running audit-only classification...');
    const result = await auditIntelligence.analyzeAuditNotice(letterText, {
      noticeDate: noticeDate ? new Date(noticeDate) : null
    });
    
    // REJECT if not an audit
    if (result.rejected) {
      console.log('Notice rejected:', result.rejectedType);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          rejected: true,
          rejectedType: result.rejectedType,
          message: result.message,
          redirectTo: result.redirectTo,
          redirectUrl: '/index.html', // Redirect to Tax Letter Help
          analysis: null
        })
      };
    }
    
    // Store in database
    let recordId = null;
    if (getSupabaseAdmin) {
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("audit_responses")
          .insert({
            user_email: userEmail,
            stripe_session_id: stripeSessionId,
            price_id: process.env.STRIPE_AUDIT_PRICE_ID,
            letter_text: letterText,
            analysis: result.analysis,
            audit_type: result.analysis.classification.type,
            risk_level: result.analysis.risks.overallRisk,
            escalation_required: result.analysis.risks.escalationRequired,
            status: "analyzed"
          })
          .select("id, created_at, status")
          .single();

        if (error) throw error;
        recordId = data.id;
        console.log('Audit record saved:', recordId);
      } catch (dbError) {
        console.error("Database error:", dbError);
      }
    }
    
    // Return structured analysis
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        rejected: false,
        message: "Audit analysis complete.",
        analysis: result.structuredOutput,
        textOutput: result.textOutput,
        recordId: recordId,
        escalationRequired: result.analysis.risks.escalationRequired,
        escalationMessage: result.analysis.escalationMessage || null
      })
    };
    
  } catch (err) {
    console.error("Error in analyze-audit-notice.js:", err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: err.message
      })
    };
  }
};


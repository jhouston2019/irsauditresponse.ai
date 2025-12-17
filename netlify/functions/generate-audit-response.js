// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Response Generator
// Purpose: Generate RESTRICTIVE audit response outlines
// NO free-form responses, NO dispute strategy

const OpenAI = require("openai");
const { getSupabaseAdmin } = require("./_supabase.js");
const auditIntelligence = require('./irs-audit-intelligence/index');

exports.handler = async (event) => {
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
    const { 
      analysis, 
      recordId = null,
      userData = {}
    } = JSON.parse(event.body || "{}");
    
    if (!analysis) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "Missing analysis data" }) 
      };
    }
    
    // Check if escalation is required
    if (analysis.escalationRiskAndWhenToStop.escalationRequired) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          escalationRequired: true,
          message: 'This audit requires professional representation. Response generation is not available.',
          escalationMessage: analysis.professionalRepresentationAdvisory.message,
          letter: null
        })
      };
    }
    
    // Initialize OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Generate RESTRICTIVE response outline
    const systemPrompt = `You are an IRS audit response preparation system.

CRITICAL CONSTRAINTS:
- Generate OUTLINES only, not complete responses
- Enforce MINIMAL narrative (max ${analysis.responsePreparationStrategy.scopeLimits.maxNarrativeLines} lines)
- NO explanations beyond what is requested
- NO volunteered information
- NO dispute language
- NO empathy or reassurance

Generate a restrictive audit response outline with:

1. Notice Identification
   - Notice number and date
   - Tax year(s) under examination
   - Items under examination

2. Scope Acknowledgment
   - Acknowledge only what is requested
   - Do not expand scope

3. Document List (if applicable)
   - List ONLY requested documents
   - No unrequested materials

4. Closing
   - Professional closing
   - Contact information
   - NO additional narrative

PROHIBITED CONTENT:
${analysis.auditAppropriateResponseOutline.prohibitedContent.map(p => `- ${p}`).join('\n')}

ALLOWED ACTIONS:
${analysis.responsePreparationStrategy.allowedActions.map(a => `- ${a}`).join('\n')}

PROHIBITED ACTIONS:
${analysis.responsePreparationStrategy.prohibitedActions.map(a => `- ${a}`).join('\n')}

Format as a business letter. Keep it minimal and procedural.`;

    const userPrompt = `Generate a restrictive audit response outline for:

Audit Type: ${analysis.auditIdentification.auditType}
Tax Years: ${analysis.auditIdentification.taxYearsUnderExamination}
Items Requested: ${analysis.whatIRSIsRequesting.requestedItems.join(', ')}

User Information:
Name: ${userData.name || '[Your Name]'}
Address: ${userData.address || '[Your Address]'}
City: ${userData.city || '[City, State ZIP]'}
SSN/TIN: ${userData.ssn || '[XXX-XX-XXXX]'}

Generate the outline following all constraints above.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3, // Low temperature for consistency
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    });

    const responseOutline = completion.choices?.[0]?.message?.content?.trim() || "";
    
    // Validate response against playbook rules
    const validation = auditIntelligence.validateProposedResponse(
      analysis.auditIdentification.auditType.toLowerCase().replace(/\s+/g, '_'),
      responseOutline,
      {
        taxYears: analysis.auditIdentification.taxYearsUnderExamination.split(', ').map(y => parseInt(y)),
        items: analysis.whatIRSIsRequesting.requestedItems
      }
    );
    
    // Add validation warnings to response
    const finalResponse = {
      letter: responseOutline,
      validation: validation,
      warnings: [
        'This is a preparation outline, not a final response',
        'Review all content before submitting to IRS',
        'Ensure you have supporting documentation for all claims',
        'Consider professional review before submission'
      ]
    };
    
    if (!validation.valid) {
      finalResponse.warnings.unshift('VALIDATION ERRORS DETECTED - Review before use');
    }

    // Update database record
    if (recordId && getSupabaseAdmin) {
      try {
        const supabase = getSupabaseAdmin();
        await supabase
          .from("audit_responses")
          .update({ 
            response_outline: responseOutline,
            validation_result: validation,
            status: "response_generated" 
          })
          .eq("id", recordId);
      } catch (dbError) {
        console.error("Database update error:", dbError);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(finalResponse)
    };
    
  } catch (error) {
    console.error("Error in generate-audit-response:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};


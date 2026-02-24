// Import dependencies with error handling
let OpenAI, fetch, pdfParse, mammoth, Tesseract, getSupabaseAdmin;

try {
  OpenAI = require("openai");
  fetch = require("node-fetch");
  pdfParse = require("pdf-parse");
  mammoth = require("mammoth");
  Tesseract = require("tesseract.js");
  const supabaseModule = require("./_supabase.js");
  getSupabaseAdmin = supabaseModule.getSupabaseAdmin;
} catch (importError) {
  // Import error - dependencies not available
}

exports.handler = async (event) => {
  // Check if dependencies loaded successfully
  if (!OpenAI) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'OpenAI dependency not loaded' })
    };
  }
  
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
    const { text, fileUrl, imageUrl, userEmail = null, priceId = process.env.STRIPE_PRICE_RESPONSE, stripeSessionId = null } = parsedBody;
    let letterText = text || "";

    // --- STEP 1: Extract text from file if provided ---
    if (fileUrl) {
      try {
        if (!pdfParse || !mammoth) {
          letterText += "\n\n[File uploaded but processing not available - please paste text manually]";
        } else {
          // Check if it's a data URL (base64 encoded file)
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
          } else {
            // Handle regular URL
            const fileResponse = await fetch(fileUrl);
            if (!fileResponse.ok) {
              throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
            }
            const fileBuffer = await fileResponse.arrayBuffer();
            const uint8 = new Uint8Array(fileBuffer);

            if (fileUrl.endsWith(".pdf")) {
              const parsed = await pdfParse(uint8);
              letterText += "\n\n" + parsed.text;
            } else if (fileUrl.endsWith(".doc") || fileUrl.endsWith(".docx")) {
              const { value } = await mammoth.extractRawText({ buffer: Buffer.from(uint8) });
              letterText += "\n\n" + value;
            }
          }
        }
      } catch (fileError) {
        letterText += "\n\n[File processing error - please paste text manually]";
      }
    }

    // --- STEP 2: Extract text from image if provided ---
    if (imageUrl) {
      try {
        if (!Tesseract) {
          letterText += "\n\n[Image uploaded but OCR processing not available - please paste text manually]";
        } else {
          // Check if it's a data URL (base64 encoded image)
          if (imageUrl.startsWith('data:')) {
            const { data: { text: extractedText } } = await Tesseract.recognize(imageUrl, "eng");
            letterText += "\n\n" + extractedText;
          } else {
            // Handle regular URL
            const { data: { text: extractedText } } = await Tesseract.recognize(imageUrl, "eng");
            letterText += "\n\n" + extractedText;
          }
        }
      } catch (imageError) {
        letterText += "\n\n[Image processing error - please paste text manually]";
      }
    }

    if (!letterText.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No text provided or extracted from files." }),
      };
    }

    // --- STEP 3: Analyze the letter using OpenAI ---
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ error: 'OpenAI API key not configured' })
      };
    }

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `
      You are a senior IRS Taxpayer Advocate with 25+ years of experience specializing in:
      - CP2000, CP2001, CP2002, CP2003 notices (Proposed Assessments)
      - 1099-K, 1099-MISC, 1099-NEC discrepancies
      - Audit notices (CP75, CP2001, Letter 2205)
      - Underpayment penalties (CP14, CP15, CP16)
      - Identity verification (5071C, 5747C, 4883C)
      - Math error notices (CP2002, CP2003)
      - Balance due notices (CP14, CP15, CP16, CP161)
      - Refund holds and offsets (CP53, CP54, CP55)
      
      Current IRS procedures as of 2024:
      - Most notices have 30-day response deadlines
      - Online response options available at irs.gov
      - Payment plans available for most balances
      - Penalty abatement possible for reasonable cause
      - Identity verification can be done online
      - Most correspondence can be handled without visiting an office
      
      Analyze this IRS letter with expert-level knowledge and provide a comprehensive response in the following JSON format. Vary your writing style and approach while maintaining accuracy:
      
      {
        "letterType": "Specific notice type (e.g., CP2000, CP2001, 1099-K, Audit Notice, etc.)",
        "summary": "Plain English explanation of what this letter means and its implications",
        "reason": "Detailed explanation of why the taxpayer received this letter",
        "requiredActions": "Specific actions needed, deadlines, and required documentation",
        "nextSteps": "Step-by-step recommended response actions with priorities",
        "confidence": 85,
        "urgency": "High/Medium/Low based on deadlines and amounts",
        "estimatedResolution": "Realistic timeframe for resolution",
        "penaltyRisk": "Potential penalties if not addressed",
        "paymentOptions": "Available payment methods and plans",
        "appealRights": "Information about appeal rights and procedures"
      }
      
      Be extremely specific about:
      - Exact deadlines and response requirements
      - Dollar amounts and calculations
      - Required supporting documentation
      - Online vs. mail response options
      - Penalty implications and abatement possibilities
      - Payment plan options and requirements
      
      Provide actionable, expert-level advice that helps the taxpayer understand their situation clearly and take appropriate action. Vary your explanation style and tone to make each analysis unique while being equally helpful.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: letterText },
      ],
      temperature: 0.7,
      top_p: 0.9,
    });
    
    let aiResponse = completion.choices?.[0]?.message?.content || "No response generated.";
    
    // Clean up markdown code blocks if present
    if (aiResponse.includes('```json')) {
      aiResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    
    // Calculate confidence score based on token usage
    const confidenceScore = Math.round(Math.max(60, Math.min(95, (1 - (completion.usage?.completion_tokens || 0) / 2048) * 100)));
    
    // Notice type recognition patterns
    const noticeTypePatterns = {
      'CP2000': /CP2000|Proposed Assessment.*Income/i,
      'CP2001': /CP2001|Proposed Assessment.*Additional Tax/i,
      'CP2002': /CP2002|Math Error/i,
      'CP2003': /CP2003|Math Error.*Additional/i,
      'CP14': /CP14|Balance Due/i,
      'CP15': /CP15|Balance Due.*Final/i,
      'CP16': /CP16|Balance Due.*Notice/i,
      'CP75': /CP75|Audit|Examination/i,
      'CP161': /CP161|Balance Due.*Final/i,
      '1099-K': /1099-K|Payment Card|Third Party Network/i,
      '1099-MISC': /1099-MISC|Miscellaneous Income/i,
      '1099-NEC': /1099-NEC|Nonemployee Compensation/i,
      '5071C': /5071C|Identity Verification/i,
      '5747C': /5747C|Identity Verification/i,
      '4883C': /4883C|Identity Verification/i,
      'CP53': /CP53|Refund Hold/i,
      'CP54': /CP54|Refund Offset/i,
      'CP55': /CP55|Refund Offset/i
    };

    // Detect notice type from letter text
    let detectedNoticeType = "Unknown";
    for (const [type, pattern] of Object.entries(noticeTypePatterns)) {
      if (pattern.test(letterText)) {
        detectedNoticeType = type;
        break;
      }
    }

    // Try to parse the AI response as JSON, fallback to plain text
    let structuredAnalysis;
    try {
      structuredAnalysis = JSON.parse(aiResponse);
      structuredAnalysis.confidence = confidenceScore;
      
      // Override with detected notice type if more specific
      if (detectedNoticeType !== "Unknown" && structuredAnalysis.letterType === "Unknown") {
        structuredAnalysis.letterType = detectedNoticeType;
      }
      
      // Add additional fields if missing
      if (!structuredAnalysis.penaltyRisk) {
        structuredAnalysis.penaltyRisk = "Review notice for specific penalty information";
      }
      if (!structuredAnalysis.paymentOptions) {
        structuredAnalysis.paymentOptions = "Contact IRS for payment plan options";
      }
      if (!structuredAnalysis.appealRights) {
        structuredAnalysis.appealRights = "You have the right to appeal within 30 days";
      }
      
    } catch (parseError) {
      structuredAnalysis = {
        letterType: detectedNoticeType,
        summary: aiResponse,
        reason: "Unable to parse structured response",
        requiredActions: "Review the summary for details",
        nextSteps: "Consider consulting a tax professional",
        confidence: Math.max(60, confidenceScore - 10), // Lower confidence for parse errors
        urgency: "Medium",
        estimatedResolution: "Varies",
        penaltyRisk: "Review notice for specific penalty information",
        paymentOptions: "Contact IRS for payment plan options",
        appealRights: "You have the right to appeal within 30 days"
      };
    }

    // --- STEP 4: Store in Supabase (optional) ---
    let recordId = null;
    if (getSupabaseAdmin) {
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase
          .from("tlh_letters")
          .insert({
            user_email: userEmail,
            stripe_session_id: stripeSessionId,
            price_id: priceId,
            letter_text: letterText,
            analysis: structuredAnalysis,
            summary: structuredAnalysis.summary || aiResponse,
            status: "analyzed"
          })
          .select("id, created_at, status")
          .single();

        if (error) throw error;
        recordId = data.id;
      } catch (dbError) {
        // Continue without database storage
      }
    }

    // --- STEP 5: Return structured response ---
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        message: "Analysis complete.",
        analysis: structuredAnalysis,
        recordId: recordId,
        summary: structuredAnalysis.summary || aiResponse
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }),
    };
  }
};
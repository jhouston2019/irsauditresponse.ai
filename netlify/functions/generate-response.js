const OpenAI = require("openai");
const { getSupabaseAdmin } = require("./_supabase.js");

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

  // Initialize OpenAI client
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { summary, recordId = null, tone = 'professional', approach = 'cooperative', style = 'detailed' } = JSON.parse(event.body || "{}");
    if (!summary) return { statusCode: 400, body: JSON.stringify({ error: "Missing summary" }) };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      top_p: 0.85,
      messages: [
        { 
          role: "system", 
          content: `You are generating a formal IRS response letter that matches the structure used in professional tax correspondence.

CRITICAL: Follow this EXACT structure for ALL responses:

-----------------------------------

[Taxpayer Name]
[Address Line 1]
[City, State ZIP]

[Date]

Internal Revenue Service
[Correct IRS Address based on notice]

RE: Response to IRS Notice [Notice Number]
Tax Year: [Year]
SSN: XXX-XX-[Last 4]

-----------------------------------

Dear Sir or Madam,

INTRO PARAGRAPH:
"This letter is submitted in response to IRS Notice [Notice Number] regarding [brief issue]. The purpose of this response is to address the discrepancy identified and provide clarification and supporting information."

-----------------------------------

SECTION 1 — NOTICE SUMMARY
[Clear explanation of what the IRS is asserting]

SECTION 2 — ISSUE RESPONSE
[Direct response to each issue raised - no hedging, no uncertainty language]

SECTION 3 — SUPPORTING POSITION
[Clarify facts and reference documentation]

-----------------------------------

CLOSING PARAGRAPH:
"Based on the information provided, we respectfully request that the IRS review this response and make any necessary adjustments to the account. Please contact me if additional information is required."

-----------------------------------

Sincerely,
[Taxpayer Name]

-----------------------------------

LANGUAGE REQUIREMENTS:
- NO casual tone or AI-style phrasing
- NO uncertainty language ("may", "might", "it seems", "appears to be")
- Use formal, controlled, declarative language
- Replace "you may want to" with "This response addresses"
- Replace "it seems" with "The discrepancy relates to"
- Replace "AI suggests" with "The following explanation is provided"
- Use "We respectfully request" for all requests

TONE: Formal, controlled, declarative, professional
MUST READ LIKE: Formal IRS correspondence from a tax professional
MUST NOT READ LIKE: AI-generated conversational text

**TONE MODIFIER: ${tone}**
**APPROACH MODIFIER: ${approach}**
**STYLE MODIFIER: ${style}**

Apply these modifiers while maintaining the formal structure above.` 
        },
        { 
          role: "user", 
          content: `Based on this IRS letter analysis, generate a formal response letter following the exact structure provided:\n\n${summary}\n\nUse proper IRS correspondence format. No casual language. No AI tone. Format as professional tax correspondence.` 
        }
      ],
    });

    const letter = completion.choices?.[0]?.message?.content?.trim() || "";

    // Update the existing record (if provided)
    if (recordId) {
      const supabase = getSupabaseAdmin();
      const { error } = await supabase
        .from("ara_letters")
        .update({ ai_response: letter, status: "responded" })
        .eq("id", recordId);
      if (error) throw error;
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ letter }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
}
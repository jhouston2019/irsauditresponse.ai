const OpenAI = require("openai");
const { authorizeWizardRequest, json, sanitizeString, corsHeaders } = require("./_wizardAuth.js");

const LETTER_SYSTEM_PROMPT = `You are a senior tax attorney and IRS correspondence specialist with 25 years
of experience handling IRS audits, CP2000 notices, deficiency notices, and
tax controversy matters. You have successfully resolved thousands of IRS disputes.

Generate a complete, professional, legally defensible IRS response letter based
on the analysis and strategy provided.

The letter must:

LEGAL STANDARDS:
- Cite specific Internal Revenue Code sections where applicable
- Reference relevant Treasury Regulations (Treas. Reg. §)
- Cite applicable Revenue Procedures and Revenue Rulings where relevant
- Use proper IRS correspondence conventions and terminology
- Never make admissions not required by the chosen strategy
- Frame all positions in the taxpayer's most favorable light
- For dispute strategy: invoke taxpayer rights under IRC § 7521 and the 
  Taxpayer Bill of Rights where applicable

FORMAT:
- Full formal business letter format
- Date: [DATE] (placeholder)
- Taxpayer info block: [TAXPAYER NAME], [ADDRESS], [CITY STATE ZIP], [SSN LAST 4]
- IRS address block (use address from notice if available)
- Re: line with notice number, tax year, SSN last 4
- Opening paragraph: clearly state purpose and taxpayer position
- Body: methodically address each discrepancy/issue
- Supporting argument section: legal basis, relevant code sections
- Request for relief section: specific resolution requested
- Closing: professional, non-adversarial, cooperative tone
- Signature block: [TAXPAYER SIGNATURE], [PRINTED NAME], [DATE], [PHONE], [EMAIL]
- Enclosures list (based on documentationNeeded from analysis)

TONE AND STRATEGY INSTRUCTIONS BY TYPE:

For AGREE strategy:
- Acknowledge IRS position clearly and without ambiguity
- Request payment plan if amount is substantial (>$2,500)
- Reference installment agreement under IRC § 6159 if applicable
- Request penalty abatement under reasonable cause if first-time issue
- Request first-time abatement (FTA) under Rev. Proc. 84-35 if eligible
- Closing: cooperative and resolution-focused

For PARTIAL AGREEMENT strategy:
- Clearly delineate agreed items from disputed items
- Agree on items with appropriate acknowledgment
- Dispute remaining items with specific factual and legal basis
- For each disputed item: state taxpayer's position, cite support, 
  request specific relief
- Request that IRS recalculate proposed amount excluding disputed items
- Reference IRC § 6213(b) for Math Error procedures if applicable

For FULL DISPUTE strategy:
- Open with clear, firm statement of taxpayer's non-agreement
- Assert all applicable taxpayer rights under Taxpayer Bill of Rights
- For each discrepancy: provide specific factual rebuttal
- Cite IRC § 6201 (IRS burden of assessment), § 7491 (burden of proof)
- Reference Cohan rule (Cohan v. Commissioner, 39 F.2d 540) if 
  documentation is imperfect but amounts are credible
- For 1099 discrepancies involving basis: assert IRC § 1012 cost basis rights
- For self-employment income disputes: cite reasonable business expense 
  deductions under IRC § 162
- Request Appeals consideration under IRC § 7803(e) if appropriate
- Demand that IRS provide substantiation of third-party reports
- Closing: firm but professional, assert right to appeal

For EXTENSION strategy:
- Request 30/60-day extension to respond
- State reason for extension (gathering documentation)
- Confirm taxpayer's intent to respond fully
- Request IRS acknowledge extension in writing
- Reference standard IRS extension practice under Rev. Proc. 2005-18

OUTPUT: Return ONLY the complete letter text. No JSON wrapper.
No markdown. Pure text formatted for printing/mailing.
The letter should be 400-800 words depending on complexity.
Use actual line breaks and spacing appropriate for a formal letter.`;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(event), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return json(405, event, { error: "Method not allowed" });
  }

  const auth = await authorizeWizardRequest(event);
  if (!auth.ok) return auth.response;

  if (!process.env.OPENAI_API_KEY) {
    return json(503, event, { error: "Letter generation is not configured." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, event, { error: "Invalid JSON body" });
  }

  const { analysis, strategy, taxpayerName, taxpayerAddress, additionalContext } = body;
  if (!analysis || typeof analysis !== "object") {
    return json(400, event, { error: "analysis object is required" });
  }
  const strat = sanitizeString(strategy || "", 32);
  if (!["agree", "partial", "dispute", "extension"].includes(strat)) {
    return json(400, event, { error: "strategy must be agree, partial, dispute, or extension" });
  }

  let analysisJson;
  try {
    analysisJson = JSON.stringify(analysis).slice(0, 120000);
  } catch {
    return json(400, event, { error: "Invalid analysis payload" });
  }

  const userMessage = `Analysis: ${analysisJson}
Strategy selected: ${strat} (agree = Full Agreement; partial = Partial Agreement; dispute = Full Dispute; extension = Request Extension)
Taxpayer name: ${sanitizeString(taxpayerName || "TAXPAYER NAME", 200)}
Taxpayer address: ${sanitizeString(taxpayerAddress || "ADDRESS", 500)}
Additional context: ${sanitizeString(additionalContext || "None provided", 4000)}

Generate the complete response letter now.`;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: LETTER_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.35,
      max_tokens: 4096,
    });

    const usage = completion.usage || null;
    if (usage) console.log(JSON.stringify({ fn: "generate-letter", usage }));

    const letter = (completion.choices?.[0]?.message?.content || "").trim();
    if (!letter) {
      return json(503, event, { error: "Letter generation produced no content. Please try again." });
    }

    const payload = { letter };
    if (usage) payload.usage = usage;
    return json(200, event, payload);
  } catch (e) {
    console.error("generate-letter error:", e);
    return json(503, event, { error: "Letter generation is temporarily unavailable. Please try again." });
  }
};

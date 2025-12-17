# IRS Audit Intelligence System

## ⚠️ AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE

This is a hardened, procedural IRS audit response preparation system designed to:
- **REJECT** all non-audit notices
- **LIMIT** response scope to prevent over-disclosure
- **ESCALATE** to professionals when risk thresholds are exceeded
- **PROTECT** taxpayers from dangerous self-responses

## Architecture

```
irs-audit-intelligence/
├── classification-engine.js    # Audit-only notice classification
├── response-playbooks.js       # Restrictive response strategies
├── deadline-calculator.js      # Deadline tracking and urgency
├── evidence-mapper.js          # Document handling (SUMMARIZE default)
├── risk-guardrails.js          # Hard stop conditions
├── output-formatter.js         # Structured output (NO EMPATHY)
├── index.js                    # Integration layer
└── README.md                   # This file
```

## Core Principles

### 1. Audit-Only Processing
**The system REJECTS all non-audit notices.**

Accepted:
- Correspondence audits
- Office audits
- Field audits
- Information Document Requests (IDR)
- Follow-up audit notices (30-day, 90-day letters)

Rejected:
- CP2000, CP2001, CP2002, CP2003 (redirect to Tax Letter Help)
- Balance due notices (CP14, CP15, CP16, CP161)
- Identity verification (5071C, 5747C, 4883C)
- Refund holds (CP53, CP54, CP55)
- 1099-K, 1099-MISC, 1099-NEC discrepancies

### 2. Hard Stop Conditions
**The system MUST escalate when:**

- Field audit detected
- Multi-year audit (2+ years)
- Dollar exposure > $25,000
- Interview requested (in-person or phone)
- Scope expansion detected
- Criminal investigation language present
- Summons issued
- 30-day or 90-day letter received

**Message shown:** "This is the point at which professional representation is strongly recommended."

### 3. Restrictive Response Generation
**The system enforces:**

- Minimal narrative (max 3-5 lines depending on audit type)
- NO volunteered information
- NO explanations beyond what is requested
- NO dispute language without representation
- NO empathy or reassurance

### 4. Evidence Handling
**Default mode: SUMMARIZE, not ATTACH**

- Explicit justification required to attach documents
- Strong warnings against bulk uploads
- Redaction guidance for sensitive information
- Scope validation for all documents

## Usage

### Analyze Audit Notice

```javascript
const auditIntelligence = require('./irs-audit-intelligence');

const result = await auditIntelligence.analyzeAuditNotice(letterText, {
  noticeDate: new Date('2024-01-15')
});

if (result.rejected) {
  // Not an audit - redirect to Tax Letter Help
  console.log(result.message);
  console.log('Redirect to:', result.redirectTo);
} else {
  // Audit analysis complete
  console.log(result.structuredOutput);
  console.log(result.textOutput);
  
  if (result.analysis.risks.escalationRequired) {
    // Professional representation required
    console.log(result.analysis.escalationMessage);
  }
}
```

### Validate Proposed Response

```javascript
const validation = auditIntelligence.validateProposedResponse(
  'correspondence_audit',
  responseContent,
  originalScope
);

if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
}

if (validation.warnings.length > 0) {
  console.log('Warnings:', validation.warnings);
}
```

### Check Document Over-Disclosure

```javascript
const overDisclosureCheck = auditIntelligence.checkDocumentOverDisclosure(
  providedDocuments,
  auditScope
);

if (overDisclosureCheck.hasRisks) {
  console.log('Over-disclosure risks detected:', overDisclosureCheck.risks);
}
```

## Output Structure

The system generates output in this exact order:

1. **Audit Type & Scope Identified**
   - Audit type, risk level, tax years, dollar exposure, items under examination

2. **What the IRS Is Requesting**
   - Specific items requested, scope limits

3. **What You Should and Should NOT Provide**
   - Explicit provision guidance, document handling rules, communication limits

4. **Response Preparation Strategy**
   - Allowed actions, prohibited actions, preparation steps

5. **Escalation Risk & When to Stop**
   - Risk level, hard stop conditions, escalation triggers

6. **Audit-Appropriate Response Outline**
   - Structured outline (NOT complete response), required sections, prohibited content

7. **Professional Representation Advisory**
   - Urgency level, reasons for representation, professional types, resources

8. **Deadline Information**
   - Notice date, response deadline, days remaining, urgency, recommendations

## Safety Locks

### Prohibited Actions Detection

The system detects and blocks:
- Volunteering information (`in addition`, `also`, `furthermore`)
- Explaining beyond request (`because`, `the reason`, `to clarify`)
- Disputing without representation (`disagree`, `contest`, `challenge`)

### Scope Expansion Detection

The system warns against:
- Mentioning tax years not under audit
- Providing unrequested documents
- Expanding narrative beyond necessity

### Over-Disclosure Protection

The system checks for:
- Documents outside audit scope
- Bulk document uploads (>50 documents)
- Excluded document categories (personal records, correspondence)

## Testing

### Test Rejection of Non-Audit Notices

```javascript
// Should reject CP2000
const cp2000Result = await auditIntelligence.analyzeAuditNotice(
  'CP2000 Notice of Proposed Assessment...'
);
console.assert(cp2000Result.rejected === true);

// Should reject balance due
const balanceDueResult = await auditIntelligence.analyzeAuditNotice(
  'CP14 Balance Due Notice...'
);
console.assert(balanceDueResult.rejected === true);
```

### Test Hard Stop Conditions

```javascript
// Should escalate for field audit
const fieldAuditResult = await auditIntelligence.analyzeAuditNotice(
  'Field Audit Notice - Revenue Agent will visit your business...'
);
console.assert(fieldAuditResult.analysis.risks.escalationRequired === true);

// Should escalate for multi-year audit
const multiYearResult = await auditIntelligence.analyzeAuditNotice(
  'Examination of tax years 2020, 2021, 2022...'
);
console.assert(multiYearResult.analysis.risks.escalationRequired === true);
```

## Maintenance

**⚠️ CRITICAL: This is a high-risk system. All modifications must:**

1. Maintain rejection of non-audit notices
2. Preserve hard stop conditions
3. Enforce restrictive response generation
4. Include comprehensive test coverage
5. Be reviewed by senior developer

**DO NOT:**
- Remove or weaken hard stop conditions
- Add conversational language or empathy
- Allow free-form advice generation
- Bypass scope validation
- Remove safety locks

## Differentiation from Tax Letter Help

| Feature | Tax Letter Help | IRS Audit Response |
|---------|----------------|-------------------|
| Price | $79 | $149 |
| Scope | All IRS notices | Audits only |
| Risk Level | Low-Medium | High-Critical |
| Escalation | Moderate | Early/Aggressive |
| Response Style | Helpful | Restrictive |
| Evidence Mode | Attach | Summarize |
| Narrative | Flexible | Minimal (3-5 lines) |
| Professional Escalation | Suggested | Required for many cases |

## Support

For issues or questions:
1. Review this README
2. Check test suite
3. Consult senior developer
4. DO NOT modify without approval

---

**This is an audit response preparation system, not a conversational AI.**


// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Response Classification Engine
// Purpose: Deterministic notice classification (AUDIT-ONLY)
// Rejects all non-audit notices

/**
 * Audit-only notice types
 * This system ONLY processes actual audit and examination notices
 */
const AUDIT_NOTICE_TYPES = {
  CORRESPONDENCE_AUDIT: {
    id: 'correspondence_audit',
    name: 'Correspondence Audit',
    patterns: [
      /correspondence\s+audit/i,
      /audit\s+by\s+mail/i,
      /examination\s+by\s+correspondence/i
    ],
    riskLevel: 'medium',
    requiresProfessional: false,
    escalationThreshold: 'multi_year_or_high_dollar'
  },
  OFFICE_AUDIT: {
    id: 'office_audit',
    name: 'Office Audit',
    patterns: [
      /office\s+audit/i,
      /examination\s+appointment/i,
      /visit\s+our\s+office/i,
      /scheduled\s+examination/i
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    escalationThreshold: 'immediate'
  },
  FIELD_AUDIT: {
    id: 'field_audit',
    name: 'Field Audit',
    patterns: [
      /field\s+audit/i,
      /field\s+examination/i,
      /revenue\s+agent/i,
      /visit\s+your\s+(business|location|premises)/i
    ],
    riskLevel: 'critical',
    requiresProfessional: true,
    escalationThreshold: 'immediate'
  },
  DOCUMENT_REQUEST: {
    id: 'document_request',
    name: 'Information Document Request (IDR)',
    patterns: [
      /information\s+document\s+request/i,
      /IDR/,
      /request\s+for\s+documents/i,
      /examination\s+.*\s+documents/i
    ],
    riskLevel: 'medium',
    requiresProfessional: false,
    escalationThreshold: 'scope_expansion'
  },
  FOLLOW_UP_AUDIT: {
    id: 'follow_up_audit',
    name: 'Follow-Up Audit Notice',
    patterns: [
      /follow[\s-]up\s+to\s+audit/i,
      /additional\s+examination/i,
      /continued\s+audit/i,
      /30[\s-]day\s+letter/i,
      /90[\s-]day\s+letter/i
    ],
    riskLevel: 'high',
    requiresProfessional: true,
    escalationThreshold: 'immediate'
  }
};

/**
 * Non-audit notices that must be REJECTED
 * These should redirect to Tax Letter Help
 */
const REJECTED_NOTICE_TYPES = [
  'CP2000', 'CP2001', 'CP2002', 'CP2003', // Proposed assessments
  'CP14', 'CP15', 'CP16', 'CP161', // Balance due
  'CP53', 'CP54', 'CP55', // Refund holds
  '5071C', '5747C', '4883C', // Identity verification
  '1099-K', '1099-MISC', '1099-NEC' // Information returns
];

/**
 * Classify notice type (AUDIT-ONLY)
 * @param {string} letterText - Raw text from IRS notice
 * @returns {Object} Classification result with rejection flag
 */
function classifyNotice(letterText) {
  const text = letterText.toLowerCase();
  
  // STEP 1: Check for rejected notice types FIRST
  for (const rejectedType of REJECTED_NOTICE_TYPES) {
    if (text.includes(rejectedType.toLowerCase())) {
      return {
        isAudit: false,
        rejected: true,
        rejectedType: rejectedType,
        message: `This is a ${rejectedType} notice, not an audit. This system only processes IRS audits and examinations.`,
        redirectTo: 'tax_letter_help',
        classification: null
      };
    }
  }
  
  // STEP 2: Classify audit type
  for (const [key, auditType] of Object.entries(AUDIT_NOTICE_TYPES)) {
    for (const pattern of auditType.patterns) {
      if (pattern.test(letterText)) {
        return {
          isAudit: true,
          rejected: false,
          classification: {
            type: auditType.id,
            name: auditType.name,
            riskLevel: auditType.riskLevel,
            requiresProfessional: auditType.requiresProfessional,
            escalationThreshold: auditType.escalationThreshold,
            confidence: calculateConfidence(letterText, auditType)
          }
        };
      }
    }
  }
  
  // STEP 3: If no audit patterns found, reject as non-audit
  return {
    isAudit: false,
    rejected: true,
    rejectedType: 'unknown_non_audit',
    message: 'This does not appear to be an IRS audit or examination notice. This system only processes audit-related correspondence.',
    redirectTo: 'tax_letter_help',
    classification: null
  };
}

/**
 * Calculate confidence score for classification
 */
function calculateConfidence(letterText, auditType) {
  let score = 0;
  const matchCount = auditType.patterns.filter(p => p.test(letterText)).length;
  
  // Base confidence on pattern matches
  score = Math.min(95, 60 + (matchCount * 15));
  
  // Boost confidence for explicit audit terminology
  if (/\b(audit|examination|examine)\b/i.test(letterText)) {
    score += 10;
  }
  
  return Math.min(95, score);
}

/**
 * Extract audit scope from notice
 */
function extractAuditScope(letterText) {
  const scope = {
    taxYears: extractTaxYears(letterText),
    items: extractAuditedItems(letterText),
    estimatedDollarAmount: extractDollarAmount(letterText),
    isMultiYear: false,
    isLargeDollar: false
  };
  
  scope.isMultiYear = scope.taxYears.length > 1;
  scope.isLargeDollar = scope.estimatedDollarAmount > 25000;
  
  return scope;
}

/**
 * Extract tax years under audit
 */
function extractTaxYears(letterText) {
  const yearPattern = /\b(20\d{2})\b/g;
  const matches = [...new Set(letterText.match(yearPattern) || [])];
  return matches.map(y => parseInt(y)).filter(y => y >= 2015 && y <= 2025);
}

/**
 * Extract items being audited
 */
function extractAuditedItems(letterText) {
  const items = [];
  const itemPatterns = [
    /schedule\s+[A-Z]/gi,
    /form\s+\d{4}/gi,
    /(charitable\s+contributions?|donations?)/gi,
    /(business\s+expenses?)/gi,
    /(home\s+office)/gi,
    /(vehicle\s+expenses?|mileage)/gi,
    /(travel\s+expenses?)/gi,
    /(meals?\s+and\s+entertainment)/gi
  ];
  
  for (const pattern of itemPatterns) {
    const matches = letterText.match(pattern);
    if (matches) {
      items.push(...matches);
    }
  }
  
  return [...new Set(items)];
}

/**
 * Extract dollar amounts
 */
function extractDollarAmount(letterText) {
  const dollarPattern = /\$[\d,]+(?:\.\d{2})?/g;
  const amounts = letterText.match(dollarPattern);
  
  if (!amounts || amounts.length === 0) return 0;
  
  // Return the largest amount found
  const numericAmounts = amounts.map(a => 
    parseFloat(a.replace(/[$,]/g, ''))
  );
  
  return Math.max(...numericAmounts);
}

module.exports = {
  classifyNotice,
  extractAuditScope,
  AUDIT_NOTICE_TYPES,
  REJECTED_NOTICE_TYPES
};


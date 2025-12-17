// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Risk Guardrails
// Purpose: Hard stop conditions and escalation enforcement
// Prevents dangerous responses

/**
 * Risk levels
 */
const RISK_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

/**
 * Hard stop conditions - system MUST escalate
 */
const HARD_STOP_CONDITIONS = {
  field_audit: {
    condition: 'Field audit detected',
    message: 'This is the point at which professional representation is strongly recommended.',
    reasoning: 'Field audits involve in-person interviews and premises access. Self-representation carries significant risk.',
    allowSelfResponse: false
  },
  
  multi_year_audit: {
    condition: 'Multi-year audit (2+ years)',
    message: 'This is the point at which professional representation is strongly recommended.',
    reasoning: 'Multi-year audits indicate pattern review and carry higher assessment risk.',
    allowSelfResponse: false
  },
  
  large_dollar_exposure: {
    condition: 'Dollar exposure exceeds $25,000',
    message: 'This is the point at which professional representation is strongly recommended.',
    reasoning: 'Large dollar amounts justify professional representation costs and reduce risk of errors.',
    allowSelfResponse: false
  },
  
  interview_request: {
    condition: 'IRS requests in-person or phone interview',
    message: 'This is the point at which professional representation is strongly recommended.',
    reasoning: 'Interviews create risk of unintended admissions and scope expansion.',
    allowSelfResponse: false
  },
  
  scope_expansion: {
    condition: 'Audit scope expanding beyond original notice',
    message: 'This is the point at which professional representation is strongly recommended.',
    reasoning: 'Scope expansion indicates deeper examination and requires strategic response.',
    allowSelfResponse: false
  },
  
  criminal_referral_language: {
    condition: 'Notice contains criminal investigation language',
    message: 'STOP. Do not respond. Seek legal counsel immediately.',
    reasoning: 'Criminal investigation requires legal representation, not tax representation.',
    allowSelfResponse: false
  },
  
  summons_issued: {
    condition: 'IRS summons issued',
    message: 'This is the point at which professional representation is strongly recommended.',
    reasoning: 'Summons are legal orders requiring compliance. Professional guidance is essential.',
    allowSelfResponse: false
  },
  
  thirty_day_letter: {
    condition: '30-day letter (formal examination notice)',
    message: 'This is the point at which professional representation is strongly recommended.',
    reasoning: '30-day letters trigger appeal rights. Professional review prevents waiver of rights.',
    allowSelfResponse: false
  },
  
  ninety_day_letter: {
    condition: '90-day letter (statutory notice of deficiency)',
    message: 'This is the point at which professional representation is strongly recommended.',
    reasoning: '90-day letters are final notices before assessment. Tax Court petition may be required.',
    allowSelfResponse: false
  }
};

/**
 * Evaluate audit risk
 */
function evaluateRisk(classification, scope, letterText) {
  const risks = {
    overallRisk: RISK_LEVELS.LOW,
    hardStops: [],
    warnings: [],
    allowSelfResponse: true,
    escalationRequired: false,
    escalationReason: null
  };
  
  // Check for hard stop conditions
  const hardStops = detectHardStops(classification, scope, letterText);
  
  if (hardStops.length > 0) {
    risks.hardStops = hardStops;
    risks.overallRisk = RISK_LEVELS.CRITICAL;
    risks.allowSelfResponse = false;
    risks.escalationRequired = true;
    risks.escalationReason = hardStops.map(hs => hs.condition).join('; ');
  }
  
  // Evaluate risk level
  if (risks.hardStops.length === 0) {
    risks.overallRisk = calculateRiskLevel(classification, scope);
    
    // Medium and high risk generate warnings
    if (risks.overallRisk === RISK_LEVELS.MEDIUM) {
      risks.warnings.push('Consider professional consultation for this audit type');
    }
    
    if (risks.overallRisk === RISK_LEVELS.HIGH) {
      risks.warnings.push('Professional representation is strongly recommended');
      risks.escalationRequired = true;
    }
  }
  
  return risks;
}

/**
 * Detect hard stop conditions
 */
function detectHardStops(classification, scope, letterText) {
  const detected = [];
  
  // Field audit
  if (classification.type === 'field_audit') {
    detected.push(HARD_STOP_CONDITIONS.field_audit);
  }
  
  // Multi-year audit
  if (scope.isMultiYear) {
    detected.push(HARD_STOP_CONDITIONS.multi_year_audit);
  }
  
  // Large dollar exposure
  if (scope.isLargeDollar) {
    detected.push(HARD_STOP_CONDITIONS.large_dollar_exposure);
  }
  
  // Interview request
  if (/interview|meeting|appointment|discuss/i.test(letterText)) {
    detected.push(HARD_STOP_CONDITIONS.interview_request);
  }
  
  // Criminal language
  if (/criminal|fraud|willful|evasion/i.test(letterText)) {
    detected.push(HARD_STOP_CONDITIONS.criminal_referral_language);
  }
  
  // Summons
  if (/summons|subpoena/i.test(letterText)) {
    detected.push(HARD_STOP_CONDITIONS.summons_issued);
  }
  
  // 30-day letter
  if (/30[\s-]day\s+letter|examination\s+report/i.test(letterText)) {
    detected.push(HARD_STOP_CONDITIONS.thirty_day_letter);
  }
  
  // 90-day letter
  if (/90[\s-]day\s+letter|statutory\s+notice|notice\s+of\s+deficiency/i.test(letterText)) {
    detected.push(HARD_STOP_CONDITIONS.ninety_day_letter);
  }
  
  return detected;
}

/**
 * Calculate risk level
 */
function calculateRiskLevel(classification, scope) {
  let riskScore = 0;
  
  // Base risk by audit type
  const typeRisk = {
    correspondence_audit: 1,
    document_request: 1,
    office_audit: 3,
    field_audit: 5,
    follow_up_audit: 3
  };
  
  riskScore += typeRisk[classification.type] || 1;
  
  // Add risk for scope factors
  if (scope.isMultiYear) riskScore += 2;
  if (scope.isLargeDollar) riskScore += 2;
  if (scope.taxYears.length > 2) riskScore += 1;
  if (scope.items.length > 5) riskScore += 1;
  
  // Map score to risk level
  if (riskScore <= 2) return RISK_LEVELS.LOW;
  if (riskScore <= 4) return RISK_LEVELS.MEDIUM;
  if (riskScore <= 6) return RISK_LEVELS.HIGH;
  return RISK_LEVELS.CRITICAL;
}

/**
 * Generate escalation message
 */
function generateEscalationMessage(risks) {
  if (!risks.escalationRequired) {
    return null;
  }
  
  const messages = [];
  
  // Add hard stop messages
  for (const hardStop of risks.hardStops) {
    messages.push({
      title: hardStop.condition,
      message: hardStop.message,
      reasoning: hardStop.reasoning
    });
  }
  
  // Add general escalation message if high risk but no hard stops
  if (messages.length === 0 && risks.overallRisk === RISK_LEVELS.HIGH) {
    messages.push({
      title: 'High Risk Audit',
      message: 'This is the point at which professional representation is strongly recommended.',
      reasoning: 'The complexity and risk level of this audit justify professional assistance.'
    });
  }
  
  return {
    escalationRequired: true,
    messages: messages,
    recommendation: 'Consult with a tax professional, enrolled agent, or tax attorney before responding.',
    resources: [
      'IRS Directory of Federal Tax Return Preparers',
      'National Association of Enrolled Agents',
      'American Bar Association Tax Section'
    ]
  };
}

/**
 * Validate response safety
 */
function validateResponseSafety(responseContent, risks) {
  const safetyIssues = [];
  
  // Check if response is allowed
  if (!risks.allowSelfResponse) {
    safetyIssues.push({
      severity: 'critical',
      issue: 'Self-response not recommended for this audit type',
      recommendation: 'Seek professional representation before responding'
    });
  }
  
  // Check for dangerous patterns in response
  const dangerousPatterns = [
    { pattern: /I admit|I acknowledge that I/i, issue: 'Unintended admission' },
    { pattern: /I didn\'t know|I wasn\'t aware/i, issue: 'Ignorance admission' },
    { pattern: /other years|previous returns/i, issue: 'Scope expansion' },
    { pattern: /cash|unreported/i, issue: 'Potential self-incrimination' }
  ];
  
  for (const { pattern, issue } of dangerousPatterns) {
    if (pattern.test(responseContent)) {
      safetyIssues.push({
        severity: 'high',
        issue: issue,
        recommendation: 'Remove this language before submitting'
      });
    }
  }
  
  return {
    isSafe: safetyIssues.length === 0,
    issues: safetyIssues
  };
}

/**
 * Check for scope expansion risk
 */
function checkScopeExpansion(originalScope, proposedResponse) {
  const expansionRisks = [];
  
  // Check if response mentions years not in audit
  const mentionedYears = extractYears(proposedResponse);
  const unauthorizedYears = mentionedYears.filter(y => 
    !originalScope.taxYears.includes(y)
  );
  
  if (unauthorizedYears.length > 0) {
    expansionRisks.push({
      risk: 'Mentions tax years not under audit',
      years: unauthorizedYears,
      recommendation: 'Remove references to years not specified in audit notice'
    });
  }
  
  // Check if response volunteers information
  if (/in addition|also|furthermore|additionally/i.test(proposedResponse)) {
    expansionRisks.push({
      risk: 'Appears to volunteer additional information',
      recommendation: 'Only respond to what is explicitly requested'
    });
  }
  
  return {
    hasExpansionRisk: expansionRisks.length > 0,
    risks: expansionRisks
  };
}

/**
 * Extract years from text
 */
function extractYears(text) {
  const yearPattern = /\b(20\d{2})\b/g;
  const matches = [...new Set(text.match(yearPattern) || [])];
  return matches.map(y => parseInt(y));
}

module.exports = {
  evaluateRisk,
  generateEscalationMessage,
  validateResponseSafety,
  checkScopeExpansion,
  RISK_LEVELS,
  HARD_STOP_CONDITIONS
};


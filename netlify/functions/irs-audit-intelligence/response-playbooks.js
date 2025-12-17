// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Response Playbooks
// Purpose: Restrictive, scope-limiting response strategies
// NO free-form advice, NO dispute strategy, NO over-disclosure

/**
 * Audit-specific response playbooks
 * Each playbook enforces narrow response scope and minimal narrative
 */
const AUDIT_PLAYBOOKS = {
  correspondence_audit: {
    id: 'correspondence_audit',
    name: 'Correspondence Audit Response',
    allowedActions: [
      'comply_as_requested',
      'clarify_scope',
      'prepare_response_outline'
    ],
    prohibitedActions: [
      'volunteer_information',
      'explain_beyond_request',
      'dispute_without_representation'
    ],
    responseStructure: {
      sections: [
        'audit_identification',
        'scope_acknowledgment',
        'requested_items_only',
        'document_list',
        'no_additional_narrative'
      ],
      maxNarrativeLines: 5,
      requiresDocumentJustification: true
    },
    escalationTriggers: [
      'multi_year_audit',
      'dollar_amount_over_25k',
      'scope_expansion_detected'
    ]
  },
  
  office_audit: {
    id: 'office_audit',
    name: 'Office Audit Response',
    allowedActions: [
      'prepare_response_outline',
      'document_preparation_only'
    ],
    prohibitedActions: [
      'attend_without_representation',
      'answer_questions_directly',
      'provide_explanations'
    ],
    responseStructure: {
      sections: [
        'audit_identification',
        'representation_notice',
        'document_preparation_list',
        'professional_escalation_required'
      ],
      maxNarrativeLines: 3,
      requiresDocumentJustification: true
    },
    escalationTriggers: [
      'immediate' // Office audits ALWAYS require professional representation
    ],
    mandatoryWarning: 'Office audits involve in-person interviews. Professional representation is strongly recommended before attending.'
  },
  
  field_audit: {
    id: 'field_audit',
    name: 'Field Audit Response',
    allowedActions: [
      'acknowledge_receipt_only',
      'seek_professional_representation'
    ],
    prohibitedActions: [
      'respond_without_representation',
      'allow_premises_access',
      'provide_any_documents',
      'answer_any_questions'
    ],
    responseStructure: {
      sections: [
        'audit_identification',
        'representation_notice_required',
        'no_self_response_permitted'
      ],
      maxNarrativeLines: 2,
      requiresDocumentJustification: false
    },
    escalationTriggers: [
      'immediate' // Field audits ALWAYS require professional representation
    ],
    mandatoryWarning: 'Field audits are high-risk examinations. DO NOT respond without professional representation. This system cannot prepare field audit responses.'
  },
  
  document_request: {
    id: 'document_request',
    name: 'Document Request Response',
    allowedActions: [
      'comply_with_specific_request',
      'clarify_ambiguous_requests',
      'prepare_document_list'
    ],
    prohibitedActions: [
      'provide_unrequested_documents',
      'explain_beyond_necessity',
      'volunteer_context'
    ],
    responseStructure: {
      sections: [
        'request_identification',
        'specific_items_requested',
        'document_list_only',
        'no_explanatory_narrative'
      ],
      maxNarrativeLines: 3,
      requiresDocumentJustification: true
    },
    escalationTriggers: [
      'scope_expansion',
      'interview_request',
      'multi_year_documents'
    ]
  },
  
  follow_up_audit: {
    id: 'follow_up_audit',
    name: 'Follow-Up Audit Notice Response',
    allowedActions: [
      'prepare_response_outline',
      'seek_professional_representation'
    ],
    prohibitedActions: [
      'respond_without_review',
      'accept_findings_without_analysis',
      'waive_appeal_rights'
    ],
    responseStructure: {
      sections: [
        'notice_identification',
        'findings_acknowledgment',
        'professional_review_required',
        'appeal_rights_preservation'
      ],
      maxNarrativeLines: 4,
      requiresDocumentJustification: false
    },
    escalationTriggers: [
      'immediate' // 30-day and 90-day letters require professional review
    ],
    mandatoryWarning: 'This is a formal examination notice with appeal rights. Professional representation is strongly recommended.'
  }
};

/**
 * Get playbook for audit type
 */
function getPlaybook(auditType) {
  return AUDIT_PLAYBOOKS[auditType] || null;
}

/**
 * Generate response outline (NOT full response)
 * This system prepares outlines, not complete responses
 */
function generateResponseOutline(auditType, scope, analysis) {
  const playbook = getPlaybook(auditType);
  
  if (!playbook) {
    return {
      error: 'No playbook available for this audit type',
      recommendation: 'Seek professional representation'
    };
  }
  
  // Check for immediate escalation
  if (shouldEscalateImmediately(playbook, scope)) {
    return {
      auditType: playbook.name,
      escalationRequired: true,
      escalationReason: getEscalationReason(playbook, scope),
      outline: null,
      warning: playbook.mandatoryWarning || 'Professional representation is required for this audit type.'
    };
  }
  
  // Generate restrictive outline
  const outline = {
    auditType: playbook.name,
    responseStructure: playbook.responseStructure.sections,
    allowedActions: playbook.allowedActions,
    prohibitedActions: playbook.prohibitedActions,
    scopeLimits: {
      maxNarrativeLines: playbook.responseStructure.maxNarrativeLines,
      documentJustificationRequired: playbook.responseStructure.requiresDocumentJustification
    },
    escalationTriggers: playbook.escalationTriggers,
    preparationGuidance: generatePreparationGuidance(playbook, scope)
  };
  
  return outline;
}

/**
 * Check if immediate escalation is required
 */
function shouldEscalateImmediately(playbook, scope) {
  // Field and office audits always escalate
  if (playbook.escalationTriggers.includes('immediate')) {
    return true;
  }
  
  // Multi-year audits escalate
  if (scope.isMultiYear && playbook.escalationTriggers.includes('multi_year_audit')) {
    return true;
  }
  
  // Large dollar amounts escalate
  if (scope.isLargeDollar && playbook.escalationTriggers.includes('dollar_amount_over_25k')) {
    return true;
  }
  
  return false;
}

/**
 * Get escalation reason
 */
function getEscalationReason(playbook, scope) {
  const reasons = [];
  
  if (playbook.escalationTriggers.includes('immediate')) {
    reasons.push('This audit type requires professional representation');
  }
  
  if (scope.isMultiYear) {
    reasons.push('Multi-year audit detected');
  }
  
  if (scope.isLargeDollar) {
    reasons.push(`Dollar amount exceeds $25,000 (estimated: $${scope.estimatedDollarAmount.toLocaleString()})`);
  }
  
  return reasons.join('. ');
}

/**
 * Generate preparation guidance (restrictive)
 */
function generatePreparationGuidance(playbook, scope) {
  const guidance = {
    whatToProvide: [],
    whatNotToProvide: [],
    documentHandling: [],
    communicationLimits: []
  };
  
  // What to provide (minimal)
  guidance.whatToProvide = [
    'Only documents explicitly requested in the notice',
    'Copies, never originals',
    'Organized by tax year and category'
  ];
  
  // What NOT to provide (critical)
  guidance.whatNotToProvide = [
    'Do not provide unrequested documents',
    'Do not provide explanatory narratives beyond what is asked',
    'Do not volunteer information about other tax years',
    'Do not provide access to original records unless subpoenaed'
  ];
  
  // Document handling
  guidance.documentHandling = [
    'Review each document before providing',
    'Redact personal information not relevant to the audit',
    'Create a transmittal list of all documents provided',
    'Keep copies of everything sent to the IRS'
  ];
  
  // Communication limits
  guidance.communicationLimits = [
    'Respond in writing only',
    'Do not engage in phone conversations without preparation',
    'Do not agree to expand the audit scope',
    'Do not waive any rights or deadlines'
  ];
  
  return guidance;
}

/**
 * Validate response against playbook rules
 */
function validateResponse(auditType, responseContent) {
  const playbook = getPlaybook(auditType);
  
  if (!playbook) {
    return { valid: false, errors: ['Invalid audit type'] };
  }
  
  const errors = [];
  
  // Check for prohibited actions
  for (const prohibited of playbook.prohibitedActions) {
    if (detectProhibitedAction(responseContent, prohibited)) {
      errors.push(`Prohibited action detected: ${prohibited}`);
    }
  }
  
  // Check narrative length
  const narrativeLines = countNarrativeLines(responseContent);
  if (narrativeLines > playbook.responseStructure.maxNarrativeLines) {
    errors.push(`Narrative too long: ${narrativeLines} lines (max: ${playbook.responseStructure.maxNarrativeLines})`);
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Detect prohibited actions in response content
 */
function detectProhibitedAction(content, action) {
  const prohibitedPatterns = {
    volunteer_information: /in addition|also|furthermore|additionally/i,
    explain_beyond_request: /because|the reason|to clarify|let me explain/i,
    dispute_without_representation: /disagree|contest|challenge|dispute/i
  };
  
  const pattern = prohibitedPatterns[action];
  return pattern ? pattern.test(content) : false;
}

/**
 * Count narrative lines (non-structural content)
 */
function countNarrativeLines(content) {
  const lines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && 
           !trimmed.startsWith('Re:') &&
           !trimmed.startsWith('Date:') &&
           !trimmed.match(/^[A-Z\s]+:$/); // Section headers
  });
  
  return lines.length;
}

module.exports = {
  getPlaybook,
  generateResponseOutline,
  shouldEscalateImmediately,
  validateResponse,
  AUDIT_PLAYBOOKS
};


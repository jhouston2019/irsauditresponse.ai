// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Output Formatter
// Purpose: Structured, procedural output (NO EMPATHY, NO REASSURANCE)
// This is containment, not comfort

/**
 * Format audit analysis output
 * NO conversational language
 * NO empathy
 * NO reassurance
 * ONLY procedural information
 */
function formatAuditAnalysis(classification, scope, risks, deadline, playbook) {
  const output = {
    auditIdentification: formatAuditIdentification(classification, scope),
    whatIRSIsRequesting: formatIRSRequests(scope),
    whatToProvideAndNotProvide: formatProvisionGuidance(playbook),
    responsePreparationStrategy: formatPreparationStrategy(playbook, scope),
    escalationRiskAndWhenToStop: formatEscalationRisk(risks),
    auditAppropriateResponseOutline: formatResponseOutline(playbook, scope),
    professionalRepresentationAdvisory: formatProfessionalAdvisory(risks),
    deadlineInformation: formatDeadlineInfo(deadline)
  };
  
  return output;
}

/**
 * Format audit identification (section 1)
 */
function formatAuditIdentification(classification, scope) {
  return {
    auditType: classification.name,
    riskLevel: classification.riskLevel.toUpperCase(),
    taxYearsUnderExamination: scope.taxYears.join(', '),
    isMultiYear: scope.isMultiYear,
    estimatedDollarExposure: scope.estimatedDollarAmount > 0 
      ? `$${scope.estimatedDollarAmount.toLocaleString()}`
      : 'Not specified',
    itemsUnderExamination: scope.items.length > 0 
      ? scope.items 
      : ['Not specified - review notice for details']
  };
}

/**
 * Format IRS requests (section 2)
 */
function formatIRSRequests(scope) {
  return {
    requestedItems: scope.items.length > 0 
      ? scope.items 
      : ['Review notice for specific items requested'],
    scopeLimits: [
      `Limited to tax year(s): ${scope.taxYears.join(', ')}`,
      'Do not provide information beyond what is explicitly requested',
      'Do not volunteer explanations for items not questioned'
    ]
  };
}

/**
 * Format provision guidance (section 3)
 */
function formatProvisionGuidance(playbook) {
  if (!playbook || !playbook.preparationGuidance) {
    return {
      whatToProvide: ['Review notice for specific requirements'],
      whatNotToProvide: ['Do not volunteer unrequested information']
    };
  }
  
  return {
    whatToProvide: playbook.preparationGuidance.whatToProvide,
    whatNotToProvide: playbook.preparationGuidance.whatNotToProvide,
    documentHandling: playbook.preparationGuidance.documentHandling,
    communicationLimits: playbook.preparationGuidance.communicationLimits
  };
}

/**
 * Format preparation strategy (section 4)
 */
function formatPreparationStrategy(playbook, scope) {
  if (!playbook) {
    return {
      strategy: 'Seek professional representation',
      allowedActions: [],
      prohibitedActions: ['Do not respond without professional guidance']
    };
  }
  
  return {
    allowedActions: playbook.allowedActions,
    prohibitedActions: playbook.prohibitedActions,
    scopeLimits: {
      maxNarrativeLines: playbook.scopeLimits.maxNarrativeLines,
      documentJustificationRequired: playbook.scopeLimits.documentJustificationRequired
    },
    preparationSteps: [
      'Review notice to identify exact items requested',
      'Gather only documents that directly respond to requests',
      'Organize documents by tax year and category',
      'Create document transmittal list',
      'Review response for scope compliance before submitting'
    ]
  };
}

/**
 * Format escalation risk (section 5)
 */
function formatEscalationRisk(risks) {
  if (risks.escalationRequired) {
    return {
      escalationRequired: true,
      riskLevel: risks.overallRisk.toUpperCase(),
      hardStopConditions: risks.hardStops.map(hs => ({
        condition: hs.condition,
        message: hs.message,
        reasoning: hs.reasoning
      })),
      recommendation: 'This is the point at which professional representation is strongly recommended.',
      allowSelfResponse: false
    };
  }
  
  return {
    escalationRequired: false,
    riskLevel: risks.overallRisk.toUpperCase(),
    warnings: risks.warnings,
    escalationTriggers: [
      'If audit scope expands beyond original notice',
      'If IRS requests interview or meeting',
      'If dollar exposure increases significantly',
      'If you are uncertain about any aspect of the response'
    ],
    allowSelfResponse: true
  };
}

/**
 * Format response outline (section 6)
 */
function formatResponseOutline(playbook, scope) {
  if (!playbook || !playbook.responseStructure) {
    return {
      outline: 'Professional representation required - no self-response outline available'
    };
  }
  
  return {
    responseStructure: playbook.responseStructure,
    requiredSections: [
      '1. Notice identification (date, number, tax year)',
      '2. Acknowledgment of items under examination',
      '3. Document transmittal list (if providing documents)',
      '4. Closing (no additional narrative)'
    ],
    prohibitedContent: [
      'Explanations beyond what is requested',
      'Volunteered information about other years',
      'Personal circumstances or hardship narratives',
      'Disputes or disagreements without representation',
      'Admissions or acknowledgments of error'
    ],
    formatRequirements: [
      'Business letter format',
      'Reference notice number and date',
      'Keep response to minimum necessary',
      'Attach document list if providing documents',
      'Retain copies of everything sent'
    ]
  };
}

/**
 * Format professional advisory (section 7)
 */
function formatProfessionalAdvisory(risks) {
  const advisory = {
    representationRecommended: risks.escalationRequired || risks.overallRisk === 'high',
    reasons: [],
    professionalTypes: [
      'Enrolled Agent (EA)',
      'Certified Public Accountant (CPA)',
      'Tax Attorney'
    ],
    resources: [
      'IRS Directory of Federal Tax Return Preparers',
      'National Association of Enrolled Agents (NAEA)',
      'American Institute of CPAs (AICPA)',
      'American Bar Association Tax Section'
    ]
  };
  
  if (risks.escalationRequired) {
    advisory.reasons = risks.hardStops.map(hs => hs.condition);
    advisory.urgency = 'IMMEDIATE';
    advisory.message = 'Professional representation is strongly recommended before responding to this audit.';
  } else if (risks.overallRisk === 'high') {
    advisory.reasons = ['High risk audit type', 'Complexity of issues'];
    advisory.urgency = 'HIGH';
    advisory.message = 'Consider professional representation for this audit.';
  } else {
    advisory.urgency = 'MEDIUM';
    advisory.message = 'Professional consultation available if needed.';
  }
  
  return advisory;
}

/**
 * Format deadline information (section 8)
 */
function formatDeadlineInfo(deadline) {
  if (!deadline || !deadline.responseDeadline) {
    return {
      deadline: 'Review notice for response deadline',
      daysRemaining: 'Unknown',
      urgency: 'Review notice immediately'
    };
  }
  
  return {
    noticeDate: deadline.noticeDate ? deadline.noticeDate.toLocaleDateString() : 'Unknown',
    responseDeadline: deadline.responseDeadline.toLocaleDateString(),
    daysRemaining: deadline.daysRemaining,
    urgency: deadline.isCritical ? 'CRITICAL' : deadline.isUrgent ? 'URGENT' : 'NORMAL',
    extensionAvailable: deadline.extensionAvailable,
    recommendation: deadline.daysRemaining <= 14 
      ? 'Immediate action required'
      : 'Begin preparation promptly'
  };
}

/**
 * Format final output as structured text
 */
function formatAsStructuredText(analysis) {
  let output = '';
  
  output += '═══════════════════════════════════════════════════════════\n';
  output += 'IRS AUDIT RESPONSE PREPARATION\n';
  output += 'PROCEDURAL ANALYSIS\n';
  output += '═══════════════════════════════════════════════════════════\n\n';
  
  output += '1. AUDIT TYPE & SCOPE IDENTIFIED\n';
  output += '─────────────────────────────────────────────────────────\n';
  output += `Audit Type: ${analysis.auditIdentification.auditType}\n`;
  output += `Risk Level: ${analysis.auditIdentification.riskLevel}\n`;
  output += `Tax Years: ${analysis.auditIdentification.taxYearsUnderExamination}\n`;
  output += `Multi-Year: ${analysis.auditIdentification.isMultiYear ? 'YES' : 'NO'}\n`;
  output += `Estimated Exposure: ${analysis.auditIdentification.estimatedDollarExposure}\n`;
  output += `Items Under Examination:\n`;
  for (const item of analysis.auditIdentification.itemsUnderExamination) {
    output += `  • ${item}\n`;
  }
  output += '\n';
  
  output += '2. WHAT THE IRS IS REQUESTING\n';
  output += '─────────────────────────────────────────────────────────\n';
  for (const item of analysis.whatIRSIsRequesting.requestedItems) {
    output += `  • ${item}\n`;
  }
  output += '\nScope Limits:\n';
  for (const limit of analysis.whatIRSIsRequesting.scopeLimits) {
    output += `  • ${limit}\n`;
  }
  output += '\n';
  
  output += '3. WHAT YOU SHOULD AND SHOULD NOT PROVIDE\n';
  output += '─────────────────────────────────────────────────────────\n';
  output += 'PROVIDE:\n';
  for (const item of analysis.whatToProvideAndNotProvide.whatToProvide) {
    output += `  ✓ ${item}\n`;
  }
  output += '\nDO NOT PROVIDE:\n';
  for (const item of analysis.whatToProvideAndNotProvide.whatNotToProvide) {
    output += `  ✗ ${item}\n`;
  }
  output += '\n';
  
  output += '4. RESPONSE PREPARATION STRATEGY\n';
  output += '─────────────────────────────────────────────────────────\n';
  output += 'Allowed Actions:\n';
  for (const action of analysis.responsePreparationStrategy.allowedActions) {
    output += `  • ${action}\n`;
  }
  output += '\nProhibited Actions:\n';
  for (const action of analysis.responsePreparationStrategy.prohibitedActions) {
    output += `  • ${action}\n`;
  }
  output += '\n';
  
  output += '5. ESCALATION RISK & WHEN TO STOP\n';
  output += '─────────────────────────────────────────────────────────\n';
  output += `Risk Level: ${analysis.escalationRiskAndWhenToStop.riskLevel}\n`;
  output += `Escalation Required: ${analysis.escalationRiskAndWhenToStop.escalationRequired ? 'YES' : 'NO'}\n`;
  
  if (analysis.escalationRiskAndWhenToStop.escalationRequired) {
    output += '\nHARD STOP CONDITIONS:\n';
    for (const condition of analysis.escalationRiskAndWhenToStop.hardStopConditions) {
      output += `\n  ${condition.condition}\n`;
      output += `  ${condition.message}\n`;
      output += `  Reason: ${condition.reasoning}\n`;
    }
  }
  output += '\n';
  
  output += '6. AUDIT-APPROPRIATE RESPONSE OUTLINE\n';
  output += '─────────────────────────────────────────────────────────\n';
  if (typeof analysis.auditAppropriateResponseOutline.outline === 'string') {
    output += analysis.auditAppropriateResponseOutline.outline + '\n';
  } else {
    output += 'Required Sections:\n';
    for (const section of analysis.auditAppropriateResponseOutline.requiredSections) {
      output += `  ${section}\n`;
    }
  }
  output += '\n';
  
  output += '7. PROFESSIONAL REPRESENTATION ADVISORY\n';
  output += '─────────────────────────────────────────────────────────\n';
  output += `Urgency: ${analysis.professionalRepresentationAdvisory.urgency}\n`;
  output += `${analysis.professionalRepresentationAdvisory.message}\n`;
  output += '\n';
  
  output += '8. DEADLINE INFORMATION\n';
  output += '─────────────────────────────────────────────────────────\n';
  output += `Response Deadline: ${analysis.deadlineInformation.responseDeadline}\n`;
  output += `Days Remaining: ${analysis.deadlineInformation.daysRemaining}\n`;
  output += `Urgency: ${analysis.deadlineInformation.urgency}\n`;
  output += `Recommendation: ${analysis.deadlineInformation.recommendation}\n`;
  output += '\n';
  
  output += '═══════════════════════════════════════════════════════════\n';
  output += 'DISCLAIMER: This is procedural preparation guidance only.\n';
  output += 'Not legal advice. Not tax advice. Not a substitute for\n';
  output += 'professional representation.\n';
  output += '═══════════════════════════════════════════════════════════\n';
  
  return output;
}

module.exports = {
  formatAuditAnalysis,
  formatAsStructuredText
};


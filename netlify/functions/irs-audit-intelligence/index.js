// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Intelligence Integration Layer
// Purpose: Orchestrate all audit intelligence modules
// This is the ONLY entry point for audit analysis

const classificationEngine = require('./classification-engine');
const responsePlaybooks = require('./response-playbooks');
const deadlineCalculator = require('./deadline-calculator');
const evidenceMapper = require('./evidence-mapper');
const riskGuardrails = require('./risk-guardrails');
const outputFormatter = require('./output-formatter');

/**
 * Main audit intelligence function
 * Orchestrates all modules in strict order
 */
async function analyzeAuditNotice(letterText, options = {}) {
  const analysis = {
    timestamp: new Date().toISOString(),
    version: '1.0.0-audit-only',
    rejected: false,
    classification: null,
    scope: null,
    risks: null,
    deadline: null,
    playbook: null,
    evidenceMap: null,
    output: null
  };
  
  try {
    // STEP 1: Classify notice (AUDIT-ONLY)
    const classification = classificationEngine.classifyNotice(letterText);
    
    // REJECT if not an audit
    if (classification.rejected) {
      return {
        rejected: true,
        rejectedType: classification.rejectedType,
        message: classification.message,
        redirectTo: classification.redirectTo,
        analysis: null
      };
    }
    
    analysis.classification = classification.classification;
    
    // STEP 2: Extract audit scope
    analysis.scope = classificationEngine.extractAuditScope(letterText);
    
    // STEP 3: Evaluate risks and check for hard stops
    analysis.risks = riskGuardrails.evaluateRisk(
      analysis.classification,
      analysis.scope,
      letterText
    );
    
    // STEP 4: Calculate deadline
    analysis.deadline = deadlineCalculator.extractDeadline(
      letterText,
      options.noticeDate
    );
    
    // STEP 5: Get appropriate playbook
    analysis.playbook = responsePlaybooks.generateResponseOutline(
      analysis.classification.type,
      analysis.scope,
      analysis
    );
    
    // STEP 6: Map evidence requirements
    if (analysis.scope.items.length > 0) {
      analysis.evidenceMap = evidenceMapper.mapRequestedItems(analysis.scope);
    }
    
    // STEP 7: Format output (NO EMPATHY)
    analysis.output = outputFormatter.formatAuditAnalysis(
      analysis.classification,
      analysis.scope,
      analysis.risks,
      analysis.deadline,
      analysis.playbook
    );
    
    // STEP 8: Generate escalation message if required
    if (analysis.risks.escalationRequired) {
      analysis.escalationMessage = riskGuardrails.generateEscalationMessage(
        analysis.risks
      );
    }
    
    return {
      rejected: false,
      analysis: analysis,
      structuredOutput: analysis.output,
      textOutput: outputFormatter.formatAsStructuredText(analysis.output)
    };
    
  } catch (error) {
    console.error('Audit intelligence error:', error);
    return {
      rejected: false,
      error: 'Analysis failed',
      details: error.message,
      analysis: null
    };
  }
}

/**
 * Validate proposed response
 */
function validateProposedResponse(auditType, responseContent, originalScope) {
  const validation = {
    valid: true,
    errors: [],
    warnings: [],
    safetyIssues: []
  };
  
  // Validate against playbook rules
  const playbookValidation = responsePlaybooks.validateResponse(
    auditType,
    responseContent
  );
  
  if (!playbookValidation.valid) {
    validation.valid = false;
    validation.errors.push(...playbookValidation.errors);
  }
  
  // Check for scope expansion
  const scopeCheck = riskGuardrails.checkScopeExpansion(
    originalScope,
    responseContent
  );
  
  if (scopeCheck.hasExpansionRisk) {
    validation.warnings.push(...scopeCheck.risks.map(r => r.risk));
  }
  
  // Validate response safety
  const safetyCheck = riskGuardrails.validateResponseSafety(
    responseContent,
    { allowSelfResponse: true, hardStops: [] }
  );
  
  if (!safetyCheck.isSafe) {
    validation.safetyIssues.push(...safetyCheck.issues);
  }
  
  return validation;
}

/**
 * Check document over-disclosure
 */
function checkDocumentOverDisclosure(providedDocuments, auditScope) {
  return evidenceMapper.checkOverDisclosure(providedDocuments, auditScope);
}

/**
 * Generate document transmittal list
 */
function generateTransmittalList(evidenceMap, providedDocuments) {
  return evidenceMapper.createTransmittalList(evidenceMap, providedDocuments);
}

module.exports = {
  analyzeAuditNotice,
  validateProposedResponse,
  checkDocumentOverDisclosure,
  generateTransmittalList
};


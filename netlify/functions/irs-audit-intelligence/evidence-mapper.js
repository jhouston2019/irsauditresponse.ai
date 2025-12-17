// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// IRS Audit Evidence Mapper
// Purpose: RESTRICTIVE document handling - default to SUMMARIZE, not ATTACH
// Prevents over-disclosure

/**
 * Evidence handling modes
 */
const EVIDENCE_MODES = {
  SUMMARIZE: 'summarize', // Default - describe what you have
  ATTACH: 'attach',       // Only if explicitly justified
  EXCLUDE: 'exclude'      // Do not mention or provide
};

/**
 * Document categories with handling rules
 */
const DOCUMENT_CATEGORIES = {
  bank_statements: {
    name: 'Bank Statements',
    defaultMode: EVIDENCE_MODES.SUMMARIZE,
    attachmentJustification: 'Only if specific transactions are questioned',
    redactionRequired: true,
    redactItems: ['account numbers', 'unrelated transactions']
  },
  receipts: {
    name: 'Receipts',
    defaultMode: EVIDENCE_MODES.ATTACH,
    attachmentJustification: 'Required to substantiate expenses',
    redactionRequired: false,
    redactItems: []
  },
  invoices: {
    name: 'Invoices',
    defaultMode: EVIDENCE_MODES.ATTACH,
    attachmentJustification: 'Required to substantiate expenses',
    redactionRequired: false,
    redactItems: []
  },
  contracts: {
    name: 'Contracts/Agreements',
    defaultMode: EVIDENCE_MODES.SUMMARIZE,
    attachmentJustification: 'Only if contract terms are disputed',
    redactionRequired: true,
    redactItems: ['personal information', 'unrelated clauses']
  },
  correspondence: {
    name: 'Correspondence',
    defaultMode: EVIDENCE_MODES.EXCLUDE,
    attachmentJustification: 'Only if directly requested',
    redactionRequired: true,
    redactItems: ['personal communications', 'privileged information']
  },
  tax_returns: {
    name: 'Tax Returns',
    defaultMode: EVIDENCE_MODES.SUMMARIZE,
    attachmentJustification: 'IRS already has these - only provide if specifically requested',
    redactionRequired: false,
    redactItems: []
  },
  financial_statements: {
    name: 'Financial Statements',
    defaultMode: EVIDENCE_MODES.SUMMARIZE,
    attachmentJustification: 'Only if financial condition is at issue',
    redactionRequired: true,
    redactItems: ['unrelated assets', 'personal accounts']
  },
  personal_records: {
    name: 'Personal Records',
    defaultMode: EVIDENCE_MODES.EXCLUDE,
    attachmentJustification: 'Rarely justified - seek professional advice',
    redactionRequired: true,
    redactItems: ['all personal information']
  }
};

/**
 * Map requested items to evidence categories
 */
function mapRequestedItems(auditScope) {
  const evidenceMap = [];
  
  for (const item of auditScope.items) {
    const category = categorizeItem(item);
    const handling = DOCUMENT_CATEGORIES[category];
    
    evidenceMap.push({
      requestedItem: item,
      category: category,
      categoryName: handling.name,
      recommendedMode: handling.defaultMode,
      attachmentJustification: handling.attachmentJustification,
      redactionRequired: handling.redactionRequired,
      redactItems: handling.redactItems,
      warning: generateHandlingWarning(handling)
    });
  }
  
  return evidenceMap;
}

/**
 * Categorize audit item
 */
function categorizeItem(item) {
  const itemLower = item.toLowerCase();
  
  if (itemLower.includes('bank') || itemLower.includes('statement')) {
    return 'bank_statements';
  }
  if (itemLower.includes('receipt')) {
    return 'receipts';
  }
  if (itemLower.includes('invoice')) {
    return 'invoices';
  }
  if (itemLower.includes('contract') || itemLower.includes('agreement')) {
    return 'contracts';
  }
  if (itemLower.includes('correspondence') || itemLower.includes('letter') || itemLower.includes('email')) {
    return 'correspondence';
  }
  if (itemLower.includes('return') || itemLower.includes('1040')) {
    return 'tax_returns';
  }
  if (itemLower.includes('financial') || itemLower.includes('balance sheet')) {
    return 'financial_statements';
  }
  
  // Default to personal records (most restrictive)
  return 'personal_records';
}

/**
 * Generate handling warning
 */
function generateHandlingWarning(handling) {
  if (handling.defaultMode === EVIDENCE_MODES.EXCLUDE) {
    return 'WARNING: Do not provide unless explicitly required. Seek professional advice.';
  }
  if (handling.defaultMode === EVIDENCE_MODES.SUMMARIZE) {
    return 'CAUTION: Summarize only. Do not attach without justification.';
  }
  if (handling.redactionRequired) {
    return 'REDACTION REQUIRED: Remove all sensitive information before providing.';
  }
  return null;
}

/**
 * Create document transmittal list
 */
function createTransmittalList(evidenceMap, providedDocuments) {
  const transmittal = {
    header: 'Document Transmittal List',
    instructions: [
      'This list identifies all documents provided in response to your examination notice',
      'Each document is numbered for reference',
      'Copies provided - originals retained'
    ],
    documents: [],
    summary: {
      totalDocuments: 0,
      totalPages: 0
    }
  };
  
  let docNumber = 1;
  for (const doc of providedDocuments) {
    transmittal.documents.push({
      number: docNumber++,
      description: doc.description,
      pages: doc.pages,
      dateRange: doc.dateRange || 'N/A',
      category: doc.category
    });
    transmittal.summary.totalPages += doc.pages;
  }
  
  transmittal.summary.totalDocuments = transmittal.documents.length;
  
  return transmittal;
}

/**
 * Validate document against scope
 */
function validateDocumentScope(document, auditScope) {
  const validation = {
    inScope: false,
    warnings: [],
    shouldProvide: false
  };
  
  // Check if document year matches audit years
  if (document.taxYear && !auditScope.taxYears.includes(document.taxYear)) {
    validation.warnings.push(`Document is for year ${document.taxYear}, which is not under audit`);
    validation.inScope = false;
    return validation;
  }
  
  // Check if document type is requested
  const isRequested = auditScope.items.some(item => 
    document.description.toLowerCase().includes(item.toLowerCase()) ||
    item.toLowerCase().includes(document.description.toLowerCase())
  );
  
  if (!isRequested) {
    validation.warnings.push('Document does not appear to be explicitly requested');
    validation.inScope = false;
    return validation;
  }
  
  validation.inScope = true;
  validation.shouldProvide = true;
  
  return validation;
}

/**
 * Generate redaction guidance
 */
function generateRedactionGuidance(category) {
  const handling = DOCUMENT_CATEGORIES[category];
  
  if (!handling.redactionRequired) {
    return {
      required: false,
      items: [],
      instructions: 'No redaction required for this document type'
    };
  }
  
  return {
    required: true,
    items: handling.redactItems,
    instructions: [
      'Use black marker or digital redaction tool',
      'Ensure redacted information is completely obscured',
      'Do not use highlighting or white-out',
      'Note redactions on transmittal list'
    ],
    example: `Redact: ${handling.redactItems.join(', ')}`
  };
}

/**
 * Check for over-disclosure risk
 */
function checkOverDisclosure(providedDocuments, auditScope) {
  const risks = [];
  
  // Check for documents outside audit years
  const outOfScopeDocs = providedDocuments.filter(doc => 
    doc.taxYear && !auditScope.taxYears.includes(doc.taxYear)
  );
  
  if (outOfScopeDocs.length > 0) {
    risks.push({
      severity: 'high',
      issue: 'Documents outside audit scope',
      count: outOfScopeDocs.length,
      recommendation: 'Remove these documents before submitting'
    });
  }
  
  // Check for bulk document uploads
  if (providedDocuments.length > 50) {
    risks.push({
      severity: 'medium',
      issue: 'Large number of documents',
      count: providedDocuments.length,
      recommendation: 'Review for relevance - you may be providing too much'
    });
  }
  
  // Check for excluded categories
  const excludedDocs = providedDocuments.filter(doc => 
    DOCUMENT_CATEGORIES[doc.category]?.defaultMode === EVIDENCE_MODES.EXCLUDE
  );
  
  if (excludedDocs.length > 0) {
    risks.push({
      severity: 'high',
      issue: 'Documents that should typically be excluded',
      count: excludedDocs.length,
      recommendation: 'Seek professional advice before providing these'
    });
  }
  
  return {
    hasRisks: risks.length > 0,
    risks: risks,
    overallRecommendation: risks.length > 0 
      ? 'Review document selection - potential over-disclosure detected'
      : 'Document selection appears appropriate'
  };
}

module.exports = {
  mapRequestedItems,
  createTransmittalList,
  validateDocumentScope,
  generateRedactionGuidance,
  checkOverDisclosure,
  EVIDENCE_MODES,
  DOCUMENT_CATEGORIES
};


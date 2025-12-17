// AUDIT CORE — HIGH RISK — DO NOT MODIFY WITHOUT FULL TEST SUITE
// Test Suite for IRS Audit Intelligence System
// Purpose: Verify rejection of non-audit notices and hard stop conditions

const auditIntelligence = require('./index');

// Test data
const TEST_NOTICES = {
  // Non-audit notices (should be REJECTED)
  cp2000: `
    CP2000 Notice
    Proposed Changes to Your Tax Return
    Tax Year: 2023
    We have information that differs from what you reported on your tax return.
    The IRS received Form 1099-MISC showing income of $15,000 that was not reported.
  `,
  
  cp14: `
    CP14 Notice
    Balance Due
    You owe $2,500 in unpaid taxes for tax year 2023.
    Please pay by the due date to avoid additional penalties and interest.
  `,
  
  identity_verification: `
    Letter 5071C
    Identity Verification
    We need to verify your identity before processing your tax return.
    Please visit IRS.gov/VerifyReturn or call 800-830-5084.
  `,
  
  // Audit notices (should be ACCEPTED)
  correspondence_audit: `
    Examination Notice
    Tax Year: 2023
    We are examining your tax return for the following items:
    - Schedule C Business Expenses
    - Home Office Deduction
    Please provide documentation to support these deductions.
    This is a correspondence audit. You may respond by mail.
  `,
  
  office_audit: `
    Examination Appointment Notice
    Tax Year: 2022
    You are scheduled for an office examination on March 15, 2024 at 10:00 AM.
    Location: IRS Office, 123 Main Street
    Items under examination: Schedule A itemized deductions
    Please bring supporting documentation.
  `,
  
  field_audit: `
    Field Audit Notice
    Tax Years: 2021, 2022, 2023
    A Revenue Agent will visit your business location to conduct an examination.
    Items under examination: Business income, expenses, and inventory.
    Estimated tax deficiency: $75,000
  `,
  
  document_request: `
    Information Document Request (IDR)
    Examination ID: 12345678
    Tax Year: 2023
    Please provide the following documents:
    1. Bank statements for all business accounts
    2. Receipts for travel expenses over $500
    3. Mileage logs for vehicle deductions
    Response due: 30 days from date of this letter
  `,
  
  thirty_day_letter: `
    30-Day Letter
    Examination Report
    Tax Year: 2022
    Based on our examination, we propose the following changes:
    - Disallowed business expenses: $25,000
    - Additional tax: $8,500
    - Penalties: $1,700
    You have 30 days to respond or request an appeal.
  `
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Test helper
function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.error(`✗ ${name}`);
    console.error(`  Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Run tests
async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('IRS AUDIT INTELLIGENCE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // TEST GROUP 1: Rejection of Non-Audit Notices
  console.log('TEST GROUP 1: Rejection of Non-Audit Notices\n');
  
  test('Should reject CP2000 notice', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.cp2000);
    assert(result.rejected === true, 'CP2000 should be rejected');
    assert(result.rejectedType === 'CP2000', 'Should identify as CP2000');
    assert(result.redirectTo === 'tax_letter_help', 'Should redirect to Tax Letter Help');
  });
  
  test('Should reject CP14 balance due notice', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.cp14);
    assert(result.rejected === true, 'CP14 should be rejected');
    assert(result.rejectedType === 'CP14', 'Should identify as CP14');
  });
  
  test('Should reject identity verification notice', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.identity_verification);
    assert(result.rejected === true, '5071C should be rejected');
    assert(result.rejectedType === '5071C', 'Should identify as 5071C');
  });
  
  // TEST GROUP 2: Acceptance of Audit Notices
  console.log('\nTEST GROUP 2: Acceptance of Audit Notices\n');
  
  test('Should accept correspondence audit', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.correspondence_audit);
    assert(result.rejected === false, 'Correspondence audit should be accepted');
    assert(result.analysis !== null, 'Should have analysis');
    assert(result.analysis.classification.type === 'correspondence_audit', 'Should classify as correspondence audit');
  });
  
  test('Should accept office audit', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.office_audit);
    assert(result.rejected === false, 'Office audit should be accepted');
    assert(result.analysis.classification.type === 'office_audit', 'Should classify as office audit');
  });
  
  test('Should accept field audit', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.field_audit);
    assert(result.rejected === false, 'Field audit should be accepted');
    assert(result.analysis.classification.type === 'field_audit', 'Should classify as field audit');
  });
  
  test('Should accept document request', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.document_request);
    assert(result.rejected === false, 'Document request should be accepted');
    assert(result.analysis.classification.type === 'document_request', 'Should classify as document request');
  });
  
  // TEST GROUP 3: Hard Stop Conditions
  console.log('\nTEST GROUP 3: Hard Stop Conditions\n');
  
  test('Should trigger hard stop for field audit', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.field_audit);
    assert(result.analysis.risks.escalationRequired === true, 'Field audit should require escalation');
    assert(result.analysis.risks.overallRisk === 'critical', 'Field audit should be critical risk');
    assert(result.analysis.risks.hardStops.length > 0, 'Should have hard stop conditions');
  });
  
  test('Should trigger hard stop for multi-year audit', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.field_audit);
    assert(result.analysis.scope.isMultiYear === true, 'Should detect multi-year audit');
    assert(result.analysis.risks.escalationRequired === true, 'Multi-year should require escalation');
  });
  
  test('Should trigger hard stop for large dollar amount', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.field_audit);
    assert(result.analysis.scope.isLargeDollar === true, 'Should detect large dollar amount');
    assert(result.analysis.risks.escalationRequired === true, 'Large dollar should require escalation');
  });
  
  test('Should trigger hard stop for office audit', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.office_audit);
    assert(result.analysis.risks.escalationRequired === true, 'Office audit should require escalation');
  });
  
  test('Should trigger hard stop for 30-day letter', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.thirty_day_letter);
    assert(result.analysis.risks.escalationRequired === true, '30-day letter should require escalation');
  });
  
  // TEST GROUP 4: Scope Extraction
  console.log('\nTEST GROUP 4: Scope Extraction\n');
  
  test('Should extract tax years correctly', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.field_audit);
    assert(result.analysis.scope.taxYears.length === 3, 'Should extract 3 tax years');
    assert(result.analysis.scope.taxYears.includes(2021), 'Should include 2021');
    assert(result.analysis.scope.taxYears.includes(2022), 'Should include 2022');
    assert(result.analysis.scope.taxYears.includes(2023), 'Should include 2023');
  });
  
  test('Should extract dollar amounts correctly', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.field_audit);
    assert(result.analysis.scope.estimatedDollarAmount === 75000, 'Should extract $75,000');
  });
  
  // TEST GROUP 5: Output Format
  console.log('\nTEST GROUP 5: Output Format\n');
  
  test('Should generate structured output', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.correspondence_audit);
    assert(result.structuredOutput !== null, 'Should have structured output');
    assert(result.structuredOutput.auditIdentification !== undefined, 'Should have audit identification');
    assert(result.structuredOutput.whatIRSIsRequesting !== undefined, 'Should have IRS requests');
    assert(result.structuredOutput.escalationRiskAndWhenToStop !== undefined, 'Should have escalation risk');
  });
  
  test('Should generate text output', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.correspondence_audit);
    assert(result.textOutput !== null, 'Should have text output');
    assert(result.textOutput.includes('AUDIT TYPE & SCOPE IDENTIFIED'), 'Should have section 1');
    assert(result.textOutput.includes('WHAT THE IRS IS REQUESTING'), 'Should have section 2');
    assert(result.textOutput.includes('ESCALATION RISK & WHEN TO STOP'), 'Should have section 5');
  });
  
  test('Should NOT contain empathy language', async () => {
    const result = await auditIntelligence.analyzeAuditNotice(TEST_NOTICES.correspondence_audit);
    const output = result.textOutput.toLowerCase();
    assert(!output.includes('don\'t worry'), 'Should not contain "don\'t worry"');
    assert(!output.includes('we understand'), 'Should not contain "we understand"');
    assert(!output.includes('you\'ll be fine'), 'Should not contain "you\'ll be fine"');
    assert(!output.includes('no need to panic'), 'Should not contain "no need to panic"');
  });
  
  // TEST GROUP 6: Response Validation
  console.log('\nTEST GROUP 6: Response Validation\n');
  
  test('Should detect prohibited actions', () => {
    const validation = auditIntelligence.validateProposedResponse(
      'correspondence_audit',
      'I would like to explain in addition to the requested documents...',
      { taxYears: [2023], items: ['Schedule C'] }
    );
    assert(!validation.valid, 'Should detect prohibited action');
  });
  
  test('Should detect scope expansion', () => {
    const validation = auditIntelligence.validateProposedResponse(
      'correspondence_audit',
      'Regarding tax year 2023 and also 2022 and 2021...',
      { taxYears: [2023], items: ['Schedule C'] }
    );
    assert(validation.warnings.length > 0, 'Should warn about scope expansion');
  });
  
  // Print results
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('TEST RESULTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  console.log('\n═══════════════════════════════════════════════════════════\n');
  
  if (results.failed > 0) {
    console.log('FAILED TESTS:\n');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  ✗ ${t.name}`);
      console.log(`    ${t.error}\n`);
    });
  }
  
  return results.failed === 0;
}

// Export for use in other modules
module.exports = {
  runTests,
  TEST_NOTICES
};

// Run tests if executed directly
if (require.main === module) {
  runTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}


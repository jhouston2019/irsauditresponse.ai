#!/usr/bin/env node

// Quick test script for IRS Audit Intelligence System
// Run: node test-audit-system.js

const testSuite = require('./netlify/functions/irs-audit-intelligence/test-suite');

console.log('Starting IRS Audit Intelligence System Tests...\n');

testSuite.runTests()
  .then(success => {
    if (success) {
      console.log('✓ All tests passed!');
      process.exit(0);
    } else {
      console.log('✗ Some tests failed.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Test execution error:', error);
    process.exit(1);
  });


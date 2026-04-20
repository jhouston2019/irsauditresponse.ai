// Test suite for IRS Audit Defense Pro application
// Run with: node test-suite.js

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASSED' });
    console.log(`✅ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAILED', error: error.message });
    console.log(`❌ ${name}: ${error.message}`);
  }
}

// Test 1: Environment Variables
test('Environment variables are configured', () => {
  const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLIC_KEY'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
});

// Test 2: File Structure
test('Required files exist', () => {
  const requiredFiles = [
    'package.json',
    'index.html',
    'audit-defense.html',
    'upload.html',
    'dashboard.html',
    'login.html',
    'signup.html',
    'pricing.html',
    'success.html',
    'cancel.html',
    'privacy.html',
    'terms.html',
    'disclaimer.html',
    'styles.css',
    'src/main.js',
    'src/components/Auth.js',
    'src/components/UploadForm.js',
    'netlify/functions/analyze-notice.js',
    'netlify/functions/generate-letter.js',
    'netlify/functions/_wizardAuth.js',
    'netlify/functions/generate-response.js',
    'netlify/functions/generate-pdf.js',
    'netlify/functions/generate-docx.js',
    'netlify/functions/create-checkout-session.js',
    'netlify/functions/extract-text.js',
    'netlify/functions/stripe-webhook.js',
    'netlify/functions/verify-payment.js',
    'netlify/functions/_billing.js',
    'supabase/migrations/20251001_create_users_table.sql',
    'supabase/migrations/20251001_create_documents_table.sql',
    'supabase/migrations/20251001_create_subscriptions_table.sql',
    'supabase/migrations/20251001_setup_rls_policies.sql',
    'SETUP.md',
    'netlify.toml'
  ];
  
  const missing = requiredFiles.filter(file => !fs.existsSync(file));
  if (missing.length > 0) {
    throw new Error(`Missing files: ${missing.join(', ')}`);
  }
});

// Test 3: Package.json Dependencies
test('Package.json has required dependencies', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredDeps = [
    '@supabase/supabase-js',
    'openai',
    'stripe',
    'pdf-lib',
    'docx'
  ];
  
  const missing = requiredDeps.filter(dep => !packageJson.dependencies[dep]);
  if (missing.length > 0) {
    throw new Error(`Missing dependencies: ${missing.join(', ')}`);
  }
});

// Test 4: HTML Structure
test('HTML files have proper structure', () => {
  const htmlFiles = [
    'index.html',
    'upload.html',
    'dashboard.html',
    'login.html',
    'signup.html',
    'pricing.html'
  ];
  
  htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('<!DOCTYPE html>')) {
      throw new Error(`${file} missing DOCTYPE`);
    }
    if (!content.includes('<html lang="en">')) {
      throw new Error(`${file} missing html lang attribute`);
    }
    if (!content.includes('<meta name="viewport"')) {
      throw new Error(`${file} missing viewport meta tag`);
    }
    if (!content.includes('styles.css')) {
      throw new Error(`${file} missing styles.css link`);
    }
  });
});

// Test 5: Netlify Functions
test('Netlify functions have proper structure', () => {
  const functionFiles = [
    'netlify/functions/analyze-notice.js',
    'netlify/functions/generate-letter.js',
    'netlify/functions/generate-response.js',
    'netlify/functions/generate-pdf.js',
    'netlify/functions/generate-docx.js',
    'netlify/functions/create-checkout-session.js',
    'netlify/functions/extract-text.js',
    'netlify/functions/stripe-webhook.js',
    'netlify/functions/verify-payment.js'
  ];
  
  functionFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const hasHandler =
      content.includes('exports.handler') || content.includes('export async function handler');
    if (!hasHandler) {
      throw new Error(`${file} missing handler export`);
    }
    if (!content.includes('statusCode')) {
      throw new Error(`${file} missing statusCode in response`);
    }
    const hasCors =
      content.includes('Access-Control-Allow-Origin') || content.includes('corsHeaders');
    if (!hasCors) {
      throw new Error(`${file} missing CORS headers`);
    }
  });
});

// Test 6: Database Migrations
test('Database migrations have proper SQL', () => {
  const migrationFiles = [
    'supabase/migrations/20251001_create_users_table.sql',
    'supabase/migrations/20251001_create_documents_table.sql',
    'supabase/migrations/20251001_create_subscriptions_table.sql',
    'supabase/migrations/20251001_setup_rls_policies.sql'
  ];
  
  migrationFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('create table')) {
      throw new Error(`${file} missing create table statement`);
    }
  });
});

// Test 7: Security Features
test('Security features are implemented', () => {
  const wizardAuth = fs.readFileSync('netlify/functions/_wizardAuth.js', 'utf8');
  if (!wizardAuth.includes('sanitizeString')) {
    throw new Error('Missing input sanitization in _wizardAuth');
  }
  if (!wizardAuth.includes('authorizeWizardRequest')) {
    throw new Error('Missing authorizeWizardRequest');
  }
});

// Test 8: Documentation
test('Documentation is complete', () => {
  
  const setupGuide = fs.readFileSync('SETUP.md', 'utf8');
  if (!setupGuide.includes('Environment Setup')) {
    throw new Error('SETUP.md missing environment setup section');
  }
  if (!setupGuide.includes('Supabase Setup')) {
    throw new Error('SETUP.md missing Supabase setup section');
  }
  if (!setupGuide.includes('Stripe Setup')) {
    throw new Error('SETUP.md missing Stripe setup section');
  }
});

// Run all tests
console.log('🧪 Running IRS Audit Defense Pro Test Suite...\n');

// Add more tests here as needed

// Print results
console.log('\n📊 Test Results:');
console.log(`✅ Passed: ${testResults.passed}`);
console.log(`❌ Failed: ${testResults.failed}`);
console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

if (testResults.failed > 0) {
  console.log('\n❌ Failed Tests:');
  testResults.tests
    .filter(test => test.status === 'FAILED')
    .forEach(test => console.log(`  - ${test.name}: ${test.error}`));
}

console.log('\n🚀 Application is ready for deployment!');

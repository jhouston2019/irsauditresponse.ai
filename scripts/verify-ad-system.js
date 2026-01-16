/**
 * AD SYSTEM VERIFICATION SCRIPT
 * 
 * Run this to verify the ad system is properly configured
 * and locked down with all safety rules enforced.
 * 
 * Usage: node scripts/verify-ad-system.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 VERIFYING AD SYSTEM CONFIGURATION\n');

let errors = 0;
let warnings = 0;

// Check 1: Verify core files exist
console.log('✓ Step 1: Checking core files...');
const coreFiles = [
  'src/ads-config.js',
  'src/ads-styles.css',
  'src/ads-manager.js'
];

coreFiles.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.error(`  ❌ Missing: ${file}`);
    errors++;
  } else {
    console.log(`  ✓ Found: ${file}`);
  }
});

// Check 2: Verify ADS_ENABLED exists
console.log('\n✓ Step 2: Checking global config...');
const configPath = path.join(__dirname, '..', 'src', 'ads-config.js');
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  if (configContent.includes('const ADS_ENABLED = true')) {
    console.log('  ✓ ADS_ENABLED found and set to true');
  } else if (configContent.includes('const ADS_ENABLED = false')) {
    console.log('  ⚠️  ADS_ENABLED is set to false (ads disabled)');
    warnings++;
  } else {
    console.error('  ❌ ADS_ENABLED not found');
    errors++;
  }
  
  if (configContent.includes('const AD_CONFIG = {')) {
    console.log('  ✓ AD_CONFIG found');
  } else {
    console.error('  ❌ AD_CONFIG not found');
    errors++;
  }
}

// Check 3: Verify page exclusions
console.log('\n✓ Step 3: Checking page exclusions...');
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  const requiredExclusions = [
    '/checkout',
    '/payment.html',
    '/login',
    '/dashboard'
  ];
  
  requiredExclusions.forEach((exclusion) => {
    if (configContent.includes(`'${exclusion}'`) || configContent.includes(`"${exclusion}"`)) {
      console.log(`  ✓ Excluded: ${exclusion}`);
    } else {
      console.error(`  ❌ Missing exclusion: ${exclusion}`);
      errors++;
    }
  });
}

// Check 4: Verify AdSense script wiring
console.log('\n✓ Step 4: Checking AdSense script wiring...');
const managerPath = path.join(__dirname, '..', 'src', 'ads-manager.js');
if (fs.existsSync(managerPath)) {
  const managerContent = fs.readFileSync(managerPath, 'utf8');
  
  if (managerContent.includes('pagead2.googlesyndication.com')) {
    console.log('  ✓ AdSense script URL found');
  } else {
    console.error('  ❌ AdSense script URL not found');
    errors++;
  }
  
  if (managerContent.includes('(window.adsbygoogle = window.adsbygoogle || []).push({})')) {
    console.log('  ✓ AdSense push call found');
  } else {
    console.error('  ❌ AdSense push call not found');
    errors++;
  }
  
  // Check for duplicate script prevention
  if (managerContent.includes('existingScript')) {
    console.log('  ✓ Duplicate script prevention implemented');
  } else {
    console.warn('  ⚠️  No duplicate script prevention found');
    warnings++;
  }
}

// Check 5: Verify ad containers
console.log('\n✓ Step 5: Checking ad containers...');
const requiredContainers = [
  'ad-post-content',
  'ad-exit-grid',
  'ad-mobile-footer'
];

const htmlFiles = [
  'irs-examination-notice.html',
  'how-to-respond-to-irs-audit.html',
  'irs-audit-help.html',
  'irs-cp2000-audit-response.html'
];

htmlFiles.forEach((file) => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    let hasAllContainers = true;
    
    requiredContainers.forEach((container) => {
      if (!content.includes(`id="${container}"`)) {
        hasAllContainers = false;
      }
    });
    
    if (hasAllContainers) {
      console.log(`  ✓ ${file}: All containers present`);
    } else {
      console.warn(`  ⚠️  ${file}: Missing some containers`);
      warnings++;
    }
  }
});

// Check 6: Verify safety rules
console.log('\n✓ Step 6: Checking safety rules...');
if (fs.existsSync(managerPath)) {
  const managerContent = fs.readFileSync(managerPath, 'utf8');
  
  const safetyChecks = [
    { name: 'Session cap enforcement', pattern: 'sessionCap' },
    { name: 'Device detection', pattern: 'window.innerWidth' },
    { name: 'Lazy loading', pattern: 'IntersectionObserver' },
    { name: 'Scroll depth trigger', pattern: 'scrollDepthTrigger' },
    { name: 'No auto-refresh', pattern: 'data-ad-refresh' }
  ];
  
  safetyChecks.forEach((check) => {
    if (managerContent.includes(check.pattern)) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.warn(`  ⚠️  ${check.name} not found`);
      warnings++;
    }
  });
}

// Check 7: Verify placeholder IDs
console.log('\n✓ Step 7: Checking for placeholder IDs...');
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  if (configContent.includes('ca-pub-XXXXXXXXXXXXXXXX')) {
    console.warn('  ⚠️  Placeholder AdSense ID detected (needs replacement)');
    warnings++;
  } else {
    console.log('  ✓ AdSense ID appears to be configured');
  }
  
  if (configContent.includes('SLOT_ID_IRS')) {
    console.warn('  ⚠️  Placeholder slot IDs detected (need replacement)');
    warnings++;
  } else {
    console.log('  ✓ Slot IDs appear to be configured');
  }
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(50));

if (errors === 0 && warnings === 0) {
  console.log('✅ ALL CHECKS PASSED');
  console.log('Ad system is properly configured and locked down.');
} else {
  if (errors > 0) {
    console.log(`❌ ${errors} ERROR(S) FOUND`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} WARNING(S) FOUND`);
  }
  
  if (warnings > 0 && errors === 0) {
    console.log('\n✓ Core system is functional, but some items need attention.');
  }
}

console.log('\n📋 NEXT STEPS:');
if (warnings > 0) {
  console.log('1. Replace placeholder AdSense IDs in src/ads-config.js');
  console.log('2. Add ad containers to remaining SEO pages');
}
console.log('3. Test on staging environment');
console.log('4. Deploy to production');

console.log('\n📚 Documentation:');
console.log('- AD-SYSTEM-README.md');
console.log('- AD-DEPLOYMENT-CHECKLIST.md');
console.log('- AD-QUICK-REFERENCE.md');

process.exit(errors > 0 ? 1 : 0);

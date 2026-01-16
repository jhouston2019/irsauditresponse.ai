/**
 * BULK ADD ADS TO ALL SEO PAGES
 * 
 * Adds ad containers to all remaining SEO pages that don't have them yet.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// All SEO pages that need ads
const pagesNeedingAds = [
  'irs-audit-letter.html',
  'irs-audit-letter-what-to-do.html',
  'irs-audit-response-help.html',
  'irs-audit-written-response.html',
  'irs-audit-explanation-letter.html',
  'irs-audit-supporting-documents.html',
  'irs-audit-document-request.html',
  'irs-audit-additional-information-requested.html',
  'irs-audit-adjustment-dispute.html',
  'irs-audit-appeal-response.html',
  'irs-audit-certified-mail-response.html',
  'irs-audit-deadline-missed.html',
  'irs-audit-notice-confusing.html',
  'irs-audit-penalties-help.html',
  'irs-correspondence-audit-response.html',
  'irs-field-audit-response.html',
  'irs-office-audit-response.html',
  'irs-office-field-audit.html',
  'irs-random-audit-response.html',
  'correspondence-audit.html',
  'resources.html',
  'resource.html'
];

// Ad script and styles to add to <head>
const headAddition = `
  <!-- Ad Styles -->
  <link rel="stylesheet" href="/src/ads-styles.css">
  
  <!-- AdSense Script -->
  <script async
    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
    crossorigin="anonymous">
  </script>`;

// Post-content ad container
const postContentAd = `
        <!-- POST-CONTENT AD (PRIMARY) -->
        <section class="native-ad post-content-ad">
          <p class="ad-label">Sponsored Resources</p>
          <div id="ad-post-content"></div>
        </section>
`;

// Exit ad container
const exitAd = `
        <!-- EXIT / SCROLL-END AD (DESKTOP ONLY) -->
        <section class="native-ad exit-grid-ad desktop-only">
          <p class="ad-label">Additional Support Options</p>
          <div id="ad-exit-grid"></div>
        </section>
`;

// Mobile footer ad and script
const footerAddition = `
  <!-- MOBILE FOOTER STICKY AD -->
  <div class="native-ad mobile-footer-ad mobile-only" id="ad-mobile-footer"></div>

  <!-- Ad Manager Script -->
  <script type="module" src="/src/ads-manager.js"></script>`;

console.log('🚀 BULK ADDING ADS TO SEO PAGES\n');

let processed = 0;
let skipped = 0;
let errors = 0;

pagesNeedingAds.forEach((filename) => {
  const filePath = path.join(__dirname, '..', filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${filename} (file not found)`);
    skipped++;
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if ads already added
    if (content.includes('ads-styles.css')) {
      console.log(`⏭️  Skipping ${filename} (ads already added)`);
      skipped++;
      return;
    }

    let modified = false;

    // Add head elements before </head>
    if (!content.includes('ads-styles.css')) {
      content = content.replace('</head>', `${headAddition}\n</head>`);
      modified = true;
    }

    // Add mobile footer ad and script before </body>
    if (!content.includes('ad-mobile-footer')) {
      content = content.replace('</body>', `${footerAddition}\n</body>`);
      modified = true;
    }

    // Try to find good insertion points for post-content and exit ads
    // Look for common patterns: before CTA buttons, before footer, after main content
    
    // Pattern 1: Before text-align:center with CTA
    const ctaPattern = /<div style="text-align:center[^>]*>[\s\S]*?<a href="[^"]*"[^>]*>[^<]+<\/a>[\s\S]*?<\/div>/i;
    if (ctaPattern.test(content) && !content.includes('ad-post-content')) {
      content = content.replace(ctaPattern, (match) => {
        return postContentAd + '\n' + match + '\n' + exitAd;
      });
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Added ads to ${filename}`);
      processed++;
    } else {
      console.log(`⚠️  Could not find insertion point for ${filename}`);
      skipped++;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filename}:`, error.message);
    errors++;
  }
});

console.log('\n' + '='.repeat(50));
console.log('SUMMARY');
console.log('='.repeat(50));
console.log(`✅ Processed: ${processed}`);
console.log(`⏭️  Skipped: ${skipped}`);
console.log(`❌ Errors: ${errors}`);
console.log(`📊 Total: ${pagesNeedingAds.length}`);

if (processed > 0) {
  console.log('\n✅ Ads successfully added to ' + processed + ' pages!');
  console.log('\n⚠️  MANUAL REVIEW REQUIRED:');
  console.log('Some pages may need manual adjustment of ad placement.');
  console.log('Check that ads are:');
  console.log('- After main content');
  console.log('- Before primary CTA');
  console.log('- Not above the fold');
}

process.exit(errors > 0 ? 1 : 0);

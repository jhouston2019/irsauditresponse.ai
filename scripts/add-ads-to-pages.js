/**
 * SCRIPT TO ADD ADS TO SEO/INFORMATIONAL PAGES
 * 
 * This script adds ad containers to all SEO/informational pages
 * while excluding checkout, payment, login, dashboard, and authenticated pages.
 */

const fs = require('fs');
const path = require('path');

// Pages that should have ads (SEO/informational pages only)
const pagesWithAds = [
  'irs-examination-notice.html',
  'how-to-respond-to-irs-audit.html',
  'irs-audit-help.html',
  'irs-cp2000-audit-response.html',
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

console.log('Adding ads to SEO/informational pages...\n');

pagesWithAds.forEach((filename) => {
  const filePath = path.join(__dirname, '..', filename);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${filename} (file not found)`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if ads already added
  if (content.includes('ads-styles.css')) {
    console.log(`⏭️  Skipping ${filename} (ads already added)`);
    return;
  }

  // Add head elements
  if (!content.includes('ads-styles.css')) {
    content = content.replace('</head>', `${headAddition}\n</head>`);
  }

  // Add mobile footer ad and script before </body>
  if (!content.includes('ad-mobile-footer')) {
    content = content.replace('</body>', `${footerAddition}\n</body>`);
  }

  // Write back
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Added ads to ${filename}`);
});

console.log('\n✅ Ad infrastructure added to all SEO pages!');
console.log('\n⚠️  MANUAL STEP REQUIRED:');
console.log('You must manually add post-content and exit ad containers to each page');
console.log('at appropriate locations in the content (after main content, before CTAs).');
console.log('\nReplace ca-pub-XXXXXXXXXXXXXXXX with your actual AdSense publisher ID.');

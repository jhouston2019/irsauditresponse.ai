# PowerShell script to add ads to all remaining SEO pages

$pages = @(
    "irs-audit-letter-what-to-do.html",
    "irs-audit-response-help.html",
    "irs-audit-written-response.html",
    "irs-audit-explanation-letter.html",
    "irs-audit-supporting-documents.html",
    "irs-audit-document-request.html",
    "irs-audit-additional-information-requested.html",
    "irs-audit-adjustment-dispute.html",
    "irs-audit-appeal-response.html",
    "irs-audit-certified-mail-response.html",
    "irs-audit-deadline-missed.html",
    "irs-audit-notice-confusing.html",
    "irs-audit-penalties-help.html",
    "irs-correspondence-audit-response.html",
    "irs-field-audit-response.html",
    "irs-office-audit-response.html",
    "irs-office-field-audit.html",
    "irs-random-audit-response.html",
    "correspondence-audit.html",
    "resources.html",
    "resource.html"
)

$headAddition = @"

  <!-- Ad Styles -->
  <link rel="stylesheet" href="/src/ads-styles.css">
  
  <!-- AdSense Script -->
  <script async
    src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
    crossorigin="anonymous">
  </script>
"@

$postContentAd = @"

        <!-- POST-CONTENT AD (PRIMARY) -->
        <section class="native-ad post-content-ad">
          <p class="ad-label">Sponsored Resources</p>
          <div id="ad-post-content"></div>
        </section>

"@

$exitAd = @"

        <!-- EXIT / SCROLL-END AD (DESKTOP ONLY) -->
        <section class="native-ad exit-grid-ad desktop-only">
          <p class="ad-label">Additional Support Options</p>
          <div id="ad-exit-grid"></div>
        </section>

"@

$footerAddition = @"

  <!-- MOBILE FOOTER STICKY AD -->
  <div class="native-ad mobile-footer-ad mobile-only" id="ad-mobile-footer"></div>

  <!-- Ad Manager Script -->
  <script type="module" src="/src/ads-manager.js"></script>
"@

$processed = 0
$skipped = 0

foreach ($page in $pages) {
    if (Test-Path $page) {
        $content = Get-Content $page -Raw
        
        if ($content -match "ads-styles.css") {
            Write-Host "Skipping $page (already has ads)"
            $skipped++
            continue
        }
        
        # Add head elements
        $content = $content -replace '</head>', "$headAddition`n</head>"
        
        # Add footer elements
        $content = $content -replace '</body>', "$footerAddition`n</body>"
        
        # Find CTA and add ads around it
        $content = $content -replace '(<div style="text-align:center[^>]*>.*?<a href="[^"]*"[^>]*>.*?</a>.*?</div>)', "$postContentAd`$1$exitAd"
        
        Set-Content $page $content -NoNewline
        Write-Host "Added ads to $page"
        $processed++
    } else {
        Write-Host "File not found: $page"
    }
}

Write-Host "`nProcessed: $processed"
Write-Host "Skipped: $skipped"

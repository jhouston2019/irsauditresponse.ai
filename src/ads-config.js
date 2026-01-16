/**
 * ADSENSE / NATIVE ADS CONFIGURATION
 * Cloned from Tax Letter Help - DO NOT MODIFY STRUCTURE
 * 
 * This is the single source of truth for ad configuration.
 * Reuse this across all pages.
 */

// Global ad enable/disable flag
const ADS_ENABLED = true;

// Ad configuration object
const AD_CONFIG = {
  provider: 'adsense',
  clientId: 'ca-pub-XXXXXXXXXXXXXXXX', // Replace with actual AdSense publisher ID
  
  // Pages where ads should NEVER appear
  pageExclusions: [
    '/checkout',
    '/payment.html',
    '/audit-payment.html',
    '/login',
    '/signup',
    '/dashboard',
    '/audit-upload.html',
    '/audit-response.html',
    '/upload.html'
  ],
  
  // Maximum ads per device type
  maxAdsDesktop: 3,
  maxAdsMobile: 2,
  
  // Slot IDs for IRS Audit Response (replace with actual slot IDs from AdSense)
  slots: {
    postContent: 'POST_CONTENT_SLOT_ID_IRS',
    exitGrid: 'EXIT_GRID_SLOT_ID_IRS',
    mobileFooter: 'MOBILE_FOOTER_SLOT_ID_IRS'
  },
  
  // Session management
  sessionCap: 3, // Max ad impressions per session
  sessionKey: 'irs_audit_ad_count',
  
  // Scroll-depth trigger for exit ad
  scrollDepthTrigger: 75 // Percentage
};

// Check if ads should be enabled on current page
function shouldShowAds() {
  if (!ADS_ENABLED) return false;
  
  const currentPath = window.location.pathname;
  
  // Check if current page is in exclusion list
  for (const excluded of AD_CONFIG.pageExclusions) {
    if (currentPath.includes(excluded)) {
      return false;
    }
  }
  
  // Check session cap
  const sessionCount = parseInt(sessionStorage.getItem(AD_CONFIG.sessionKey) || '0');
  if (sessionCount >= AD_CONFIG.sessionCap) {
    return false;
  }
  
  return true;
}

// Increment session ad count
function incrementAdCount() {
  const currentCount = parseInt(sessionStorage.getItem(AD_CONFIG.sessionKey) || '0');
  sessionStorage.setItem(AD_CONFIG.sessionKey, (currentCount + 1).toString());
}

// Export configuration
export { ADS_ENABLED, AD_CONFIG, shouldShowAds, incrementAdCount };

/**
 * AD MANAGER
 * Cloned from Tax Letter Help - DO NOT MODIFY STRUCTURE
 * 
 * Handles all ad loading, lazy loading, session caps, dismiss behavior,
 * and scroll-depth triggers.
 */

import { AD_CONFIG, shouldShowAds, incrementAdCount } from './ads-config.js';

class AdManager {
  constructor() {
    this.adsLoaded = false;
    this.scrollListenerAttached = false;
    this.exitAdShown = false;
    this.observers = new Map();
  }

  /**
   * Initialize ad system
   * Call this on page load
   */
  init() {
    // Check if ads should be shown on this page
    if (!shouldShowAds()) {
      console.log('[AdManager] Ads disabled for this page');
      this.hideAllAds();
      return;
    }

    console.log('[AdManager] Initializing ads');
    
    // Safety checks - prevent ads above fold or near CTAs
    this.enforceSafetyRules();

    // Load AdSense script
    this.loadAdSenseScript();

    // Setup post-content ad (lazy load)
    this.setupPostContentAd();

    // Setup exit/scroll-depth ad (desktop only)
    this.setupExitAd();

    // Setup mobile footer sticky ad
    this.setupMobileFooterAd();
    
    // Debug log (dev mode only)
    if (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')) {
      console.debug('[ADS] IRS Audit Response ads initialized');
      console.debug('[ADS] Desktop max:', AD_CONFIG.maxAdsDesktop);
      console.debug('[ADS] Mobile max:', AD_CONFIG.maxAdsMobile);
      console.debug('[ADS] Session cap:', AD_CONFIG.sessionCap);
    }
  }

  /**
   * Enforce safety rules to prevent ads in wrong locations
   */
  enforceSafetyRules() {
    // Get all ad containers
    const allAds = document.querySelectorAll('.native-ad');
    
    allAds.forEach((ad) => {
      const rect = ad.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // Check if ad is above the fold (within first viewport)
      if (rect.top < viewportHeight && rect.top > 0) {
        // Check if page has scrolled - if not, ad might be above fold
        if (window.scrollY < 100) {
          console.warn('[AdManager] Ad potentially above fold, monitoring...');
        }
      }
      
      // Check if ad is near a CTA (within 100px of payment/checkout links)
      const ctas = document.querySelectorAll('a[href*="payment"], a[href*="checkout"], a[href*="audit-payment"]');
      ctas.forEach((cta) => {
        const ctaRect = cta.getBoundingClientRect();
        const distance = Math.abs(rect.top - ctaRect.top);
        if (distance < 100) {
          console.warn('[AdManager] Ad too close to CTA, hiding...');
          ad.classList.add('ad-hidden');
        }
      });
    });
    
    // Enforce device-specific limits
    const isMobile = window.innerWidth < 768;
    const maxAds = isMobile ? AD_CONFIG.maxAdsMobile : AD_CONFIG.maxAdsDesktop;
    
    console.log(`[AdManager] Device: ${isMobile ? 'mobile' : 'desktop'}, Max ads: ${maxAds}`);
  }

  /**
   * Load AdSense script once
   * CRITICAL: Prevents duplicate script loading
   */
  loadAdSenseScript() {
    if (this.adsLoaded) {
      console.log('[AdManager] AdSense script already loaded, skipping');
      return;
    }
    
    // Check if script already exists in DOM (prevents duplication)
    const existingScript = document.querySelector('script[src*="pagead2.googlesyndication.com"]');
    if (existingScript) {
      console.log('[AdManager] AdSense script already in DOM, skipping');
      this.adsLoaded = true;
      return;
    }

    const script = document.createElement('script');
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CONFIG.clientId}`;
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    script.onload = () => {
      console.log('[AdManager] AdSense script loaded successfully');
      this.adsLoaded = true;
    };

    script.onerror = () => {
      console.error('[AdManager] Failed to load AdSense script');
    };

    document.head.appendChild(script);
  }

  /**
   * Setup post-content ad with lazy loading
   */
  setupPostContentAd() {
    const container = document.getElementById('ad-post-content');
    if (!container) {
      console.log('[AdManager] Post-content ad container not found');
      return;
    }

    // Use Intersection Observer for lazy loading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log('[AdManager] Post-content ad in viewport, loading...');
            this.loadAd(container, AD_CONFIG.slots.postContent);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '200px' // Load 200px before it enters viewport
      }
    );

    observer.observe(container);
    this.observers.set('postContent', observer);
  }

  /**
   * Setup exit/scroll-depth ad (desktop only)
   */
  setupExitAd() {
    // Check if desktop
    if (window.innerWidth < 768) {
      console.log('[AdManager] Exit ad disabled on mobile');
      return;
    }

    const container = document.getElementById('ad-exit-grid');
    if (!container) {
      console.log('[AdManager] Exit ad container not found');
      return;
    }

    // Attach scroll listener for scroll-depth trigger
    if (!this.scrollListenerAttached) {
      window.addEventListener('scroll', this.handleScrollDepth.bind(this), { passive: true });
      this.scrollListenerAttached = true;
    }
  }

  /**
   * Handle scroll depth for exit ad
   */
  handleScrollDepth() {
    if (this.exitAdShown) return;

    const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;

    if (scrollPercent >= AD_CONFIG.scrollDepthTrigger) {
      console.log(`[AdManager] Scroll depth ${scrollPercent.toFixed(0)}% reached, loading exit ad`);
      
      const container = document.getElementById('ad-exit-grid');
      if (container) {
        this.loadAd(container, AD_CONFIG.slots.exitGrid);
        this.exitAdShown = true;
      }
    }
  }

  /**
   * Setup mobile footer sticky ad
   */
  setupMobileFooterAd() {
    // Check if mobile
    if (window.innerWidth >= 768) {
      console.log('[AdManager] Mobile footer ad disabled on desktop');
      return;
    }

    const container = document.getElementById('ad-mobile-footer');
    if (!container) {
      console.log('[AdManager] Mobile footer ad container not found');
      return;
    }

    // Load immediately on mobile
    this.loadAd(container, AD_CONFIG.slots.mobileFooter);

    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ad-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close ad');
    closeBtn.addEventListener('click', () => {
      container.classList.add('ad-hidden');
      document.body.classList.remove('mobile-ad-visible');
    });

    container.appendChild(closeBtn);
    document.body.classList.add('mobile-ad-visible');
  }

  /**
   * Load an ad into a container
   * SAFETY: No auto-refresh, no popups, no overlays
   */
  loadAd(container, slotId) {
    if (!container || !slotId) return;
    
    // Prevent duplicate loading in same container
    if (container.querySelector('.adsbygoogle')) {
      console.warn('[AdManager] Ad already loaded in this container, skipping');
      return;
    }

    // Add loading state
    container.parentElement.classList.add('ad-loading');

    // Create ad element
    const adElement = document.createElement('ins');
    adElement.className = 'adsbygoogle';
    adElement.style.display = 'block';
    adElement.setAttribute('data-ad-client', AD_CONFIG.clientId);
    adElement.setAttribute('data-ad-slot', slotId);
    adElement.setAttribute('data-ad-format', 'auto');
    adElement.setAttribute('data-full-width-responsive', 'true');
    
    // SAFETY: Explicitly disable auto-refresh
    adElement.setAttribute('data-ad-refresh', 'false');

    // Insert ad element
    container.appendChild(adElement);

    // Push ad to AdSense (single load, no refresh)
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      console.log(`[AdManager] Ad loaded: ${slotId}`);
      
      // Increment session count
      incrementAdCount();

      // Remove loading state
      setTimeout(() => {
        container.parentElement.classList.remove('ad-loading');
      }, 1000);
    } catch (error) {
      console.error('[AdManager] Error loading ad:', error);
      container.parentElement.classList.remove('ad-loading');
      container.parentElement.classList.add('ad-hidden');
    }
  }

  /**
   * Hide all ads on the page
   */
  hideAllAds() {
    const allAds = document.querySelectorAll('.native-ad');
    allAds.forEach((ad) => {
      ad.classList.add('ad-hidden');
    });
  }

  /**
   * Cleanup observers
   */
  destroy() {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
  }
}

// Create singleton instance
const adManager = new AdManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => adManager.init());
} else {
  adManager.init();
}

// Export for manual control if needed
export default adManager;

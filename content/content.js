/**
 * @fileoverview Content script for FocusGuard behavior-based distraction detection.
 * Tracks user activity on websites and sends data to background service worker.
 * Provides gentle warnings for extended site visits.
 * @module content
 */

/**
 * Time threshold in minutes before showing distraction warning
 * @constant {number}
 */
const DISTRACTION_THRESHOLD_MINUTES = 10;

/**
 * Check interval in milliseconds for time tracking
 * @constant {number}
 */
const CHECK_INTERVAL_MS = 60000; // Check every minute

/**
 * Minimum time in milliseconds before sending first heartbeat
 * @constant {number}
 */
const MIN_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

/**
 * Session data for this tab
 * @type {Object}
 */
let sessionData = {
  domain: null,
  startTime: null,
  lastActivityTime: null,
  totalActiveTime: 0,
  isActive: false,
  warningShown: false
};

/**
 * Interval ID for periodic checks
 * @type {number|null}
 */
let checkIntervalId = null;

/**
 * Timeout ID for inactivity detection
 * @type {number|null}
 */
let inactivityTimeoutId = null;

/**
 * Warning overlay element
 * @type {HTMLElement|null}
 */
let warningOverlay = null;

/**
 * Initialize content script
 */
function init() {
  // Check if this is a valid page to track
  if (!shouldTrackPage()) {
    return;
  }
  
  // Initialize session data
  initializeSession();
  
  // Setup event listeners
  setupEventListeners();
  
  // Start tracking
  startTracking();
  
  // Send initial heartbeat to background
  sendHeartbeat();
  
  console.log('FocusGuard Content: Tracking started for', sessionData.domain);
}

/**
 * Check if current page should be tracked
 * @returns {boolean} True if page should be tracked
 */
function shouldTrackPage() {
  const url = window.location.href;
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  // Don't track chrome:// pages
  if (protocol === 'chrome:') {
    return false;
  }
  
  // Don't track extension pages
  if (url.includes('chrome-extension://')) {
    return false;
  }
  
  // Don't track file:// pages
  if (protocol === 'file:') {
    return false;
  }
  
  // Don't track localhost (development)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }
  
  // Don't track new tab page
  if (url === 'about:blank' || url === 'chrome://newtab/') {
    return false;
  }
  
  return true;
}

/**
 * Initialize session data
 */
function initializeSession() {
  const now = Date.now();
  sessionData = {
    domain: window.location.hostname,
    startTime: now,
    lastActivityTime: now,
    totalActiveTime: 0,
    isActive: !document.hidden,
    warningShown: false
  };
}

/**
 * Setup event listeners for activity tracking
 */
function setupEventListeners() {
  // Track visibility changes (tab switch, minimize)
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Track user activity
  document.addEventListener('mousemove', handleUserActivity);
  document.addEventListener('keydown', handleUserActivity);
  document.addEventListener('click', handleUserActivity);
  document.addEventListener('scroll', handleUserActivity);
  
  // Handle page unload
  window.addEventListener('beforeunload', handleBeforeUnload);
  
  // Handle focus/blur
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('blur', handleWindowBlur);
}

/**
 * Start periodic tracking
 */
function startTracking() {
  // Check every minute for time threshold
  checkIntervalId = setInterval(checkTimeThreshold, CHECK_INTERVAL_MS);
}

/**
 * Handle visibility change (tab switch, minimize)
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Page is hidden - pause tracking
    pauseTracking();
  } else {
    // Page is visible - resume tracking
    resumeTracking();
  }
}

/**
 * Handle window focus
 */
function handleWindowFocus() {
  sessionData.isActive = true;
  sessionData.lastActivityTime = Date.now();
}

/**
 * Handle window blur
 */
function handleWindowBlur() {
  sessionData.isActive = false;
}

/**
 * Pause tracking when tab is not visible
 */
function pauseTracking() {
  sessionData.isActive = false;
  
  // Send session update to background
  sendSessionUpdate();
  
  console.log('FocusGuard Content: Tracking paused for', sessionData.domain);
}

/**
 * Resume tracking when tab becomes visible
 */
function resumeTracking() {
  sessionData.isActive = true;
  sessionData.lastActivityTime = Date.now();
  
  console.log('FocusGuard Content: Tracking resumed for', sessionData.domain);
}

/**
 * Handle user activity events
 */
function handleUserActivity() {
  const now = Date.now();
  
  // Update last activity time
  sessionData.lastActivityTime = now;
  
  // Mark as active
  if (!sessionData.isActive) {
    sessionData.isActive = true;
  }
  
  // Clear inactivity timeout
  if (inactivityTimeoutId) {
    clearTimeout(inactivityTimeoutId);
  }
  
  // Set new inactivity timeout (5 minutes of no activity)
  inactivityTimeoutId = setTimeout(() => {
    sessionData.isActive = false;
  }, 300000);
}

/**
 * Check if time threshold has been exceeded
 */
function checkTimeThreshold() {
  if (!sessionData.isActive || sessionData.warningShown) {
    return;
  }
  
  // Calculate time spent
  const now = Date.now();
  const timeSpent = now - sessionData.startTime;
  const minutesSpent = Math.floor(timeSpent / 60000);
  
  // Check if threshold exceeded
  if (minutesSpent >= DISTRACTION_THRESHOLD_MINUTES) {
    showDistractionWarning(minutesSpent);
  }
}

/**
 * Show distraction warning overlay
 * @param {number} minutesSpent - Minutes spent on site
 */
function showDistractionWarning(minutesSpent) {
  if (warningOverlay || sessionData.warningShown) {
    return;
  }
  
  sessionData.warningShown = true;
  
  // Create warning overlay
  warningOverlay = document.createElement('div');
  warningOverlay.id = 'focusguard-warning';
  warningOverlay.innerHTML = `
    <div class="focusguard-warning-content">
      <div class="focusguard-warning-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div class="focusguard-warning-text">
        <h3>Stay Focused!</h3>
        <p>You've been on this site for <strong>${minutesSpent} minutes</strong>.</p>
        <p class="focusguard-warning-sub">Remember your goals and stay productive.</p>
      </div>
      <button class="focusguard-warning-close" id="focusguardWarningClose">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(warningOverlay);
  
  // Add close handler
  document.getElementById('focusguardWarningClose').addEventListener('click', closeWarning);
  
  // Auto-close after 10 seconds
  setTimeout(closeWarning, 10000);
  
  // Notify background
  chrome.runtime.sendMessage({
    action: 'distractionWarning',
    data: {
      domain: sessionData.domain,
      minutesSpent: minutesSpent,
      url: window.location.href
    }
  });
  
  console.log('FocusGuard Content: Distraction warning shown for', sessionData.domain);
}

/**
 * Close warning overlay
 */
function closeWarning() {
  if (warningOverlay) {
    warningOverlay.remove();
    warningOverlay = null;
  }
}

/**
 * Handle page unload
 */
function handleBeforeUnload() {
  // Send final session update
  sendSessionUpdate();
  
  // Clear intervals
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
  }
  
  if (inactivityTimeoutId) {
    clearTimeout(inactivityTimeoutId);
  }
}

/**
 * Send heartbeat to background service worker
 */
function sendHeartbeat() {
  chrome.runtime.sendMessage({
    action: 'contentHeartbeat',
    data: {
      domain: sessionData.domain,
      url: window.location.href,
      timestamp: Date.now(),
      isActive: sessionData.isActive
    }
  });
}

/**
 * Send session update to background service worker
 */
function sendSessionUpdate() {
  const now = Date.now();
  const sessionDuration = now - sessionData.startTime;
  
  chrome.runtime.sendMessage({
    action: 'sessionUpdate',
    data: {
      domain: sessionData.domain,
      url: window.location.href,
      startTime: sessionData.startTime,
      endTime: now,
      duration: sessionDuration,
      warningShown: sessionData.warningShown
    }
  });
}

/**
 * Listen for messages from background service worker
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'pingContentScript':
      // Respond to ping to confirm content script is active
      sendResponse({ success: true, domain: sessionData.domain });
      break;
      
    case 'getSessionData':
      // Return current session data
      sendResponse({
        success: true,
        data: {
          ...sessionData,
          currentTime: Date.now()
        }
      });
      break;
      
    case 'showWarning':
      // Force show warning from background
      showDistractionWarning(message.minutes || DISTRACTION_THRESHOLD_MINUTES);
      sendResponse({ success: true });
      break;
      
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
  
  return true; // Keep channel open for async response
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

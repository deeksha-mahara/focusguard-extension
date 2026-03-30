/**
 * @fileoverview Blocked page script for FocusGuard extension.
 * Handles the blocked page UI and interactions.
 * @module blocked
 */

// Import modules
let storage = null;
let utils = null;
let stats = null;

/**
 * Initialize blocked page
 * @async
 */
async function init() {
  try {
    // Load modules
    storage = await import(chrome.runtime.getURL('background/storage.js'));
    utils = await import(chrome.runtime.getURL('background/utils.js'));
    stats = await import(chrome.runtime.getURL('background/stats.js'));
    
    // Track this blocked visit
    await trackBlockedVisit();
    
    // Load and display data
    await loadData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start timer updates
    startTimerUpdates();
    
  } catch (error) {
    console.error('FocusGuard Blocked: Initialization error:', error);
  }
}

/**
 * Track this blocked site visit
 * @async
 */
async function trackBlockedVisit() {
  try {
    // Update legacy stats (for backward compatibility)
    await storage.incrementBlockedCount();
    await storage.addTimeSaved(5);
    
    // Update new daily analytics stats
    if (stats) {
      await stats.updateDailyStats(1);
    }
    
  } catch (error) {
    console.error('FocusGuard Blocked: Track visit error:', error);
  }
}

/**
 * Load all data for the blocked page
 * @async
 */
async function loadData() {
  try {
    // Get blocked site from URL
    const blockedSite = getBlockedSiteFromUrl();
    document.getElementById('blockedSite').textContent = blockedSite || 'a distracting website';
    
    // Load and display quote
    displayRandomQuote();
    
    // Load stats
    await loadStats();
    
    // Load status and update timer
    await updateStatus();
    
  } catch (error) {
    console.error('FocusGuard Blocked: Load data error:', error);
  }
}

/**
 * Get the blocked site from URL parameters
 * @returns {string|null} The blocked site URL
 */
function getBlockedSiteFromUrl() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const site = urlParams.get('site');
    
    if (site) {
      return decodeURIComponent(site);
    }
    
    // Try to get from document.referrer
    if (document.referrer) {
      const url = new URL(document.referrer);
      return url.hostname;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Display a random motivational quote
 */
function displayRandomQuote() {
  const quote = utils.getRandomQuote();
  const parts = quote.split(' - ');
  
  const quoteText = parts[0];
  const quoteAuthor = parts[1] ? `- ${parts[1]}` : '';
  
  document.getElementById('motivationalQuote').textContent = quoteText;
  document.getElementById('quoteAuthor').textContent = quoteAuthor;
}

/**
 * Load and display statistics
 * @async
 */
async function loadStats() {
  try {
    // Load legacy stats for display
    const legacyStats = await storage.getStats();
    
    // Load today's stats from new analytics
    let todayStats = { blockedCount: 0, timeSaved: 0 };
    if (stats) {
      todayStats = await stats.getTodayStats();
    }
    
    // Display the higher of legacy or today's stats (for smooth transition)
    const displayBlocked = Math.max(legacyStats.sitesBlocked || 0, todayStats.blockedCount);
    const displayTimeSaved = Math.max(legacyStats.timeSaved || 0, todayStats.timeSaved);
    
    document.getElementById('sitesBlocked').textContent = displayBlocked;
    document.getElementById('timeSaved').textContent = utils.formatDuration(displayTimeSaved);
    
  } catch (error) {
    console.error('FocusGuard Blocked: Load stats error:', error);
  }
}

/**
 * Update status and timer display
 * @async
 */
async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    
    if (!response.success) {
      return;
    }
    
    const status = response.data;
    
    // Update timer
    const timerEl = document.getElementById('timeRemaining');
    if (status.onBreak) {
      timerEl.textContent = `Break: ${status.breakTimeRemaining}m`;
      timerEl.style.color = 'var(--accent-warning)';
    } else if (status.focusTimeRemaining) {
      timerEl.textContent = utils.formatDuration(status.focusTimeRemaining);
      timerEl.style.color = 'var(--accent-primary)';
    } else {
      timerEl.textContent = 'No active schedule';
      timerEl.style.color = 'var(--text-tertiary)';
    }
    
    // Update break button
    updateBreakButton(status);
    
  } catch (error) {
    console.error('FocusGuard Blocked: Update status error:', error);
  }
}

/**
 * Update break button state
 * @param {Object} status - Status object from background
 */
function updateBreakButton(status) {
  const breakBtn = document.getElementById('takeBreakBtn');
  const cooldownText = document.getElementById('cooldownText');
  
  if (status.onBreak) {
    breakBtn.disabled = true;
    breakBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3v18"/>
        <path d="M8 21h8"/>
        <path d="M8 3h8"/>
        <path d="M6 8a6 6 0 0 1 12 0v4a6 6 0 0 1-12 0V8z"/>
      </svg>
      On Break
    `;
    cooldownText.textContent = `${status.breakTimeRemaining} minutes remaining`;
  } else if (status.canTakeBreak) {
    breakBtn.disabled = false;
    breakBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3v18"/>
        <path d="M8 21h8"/>
        <path d="M8 3h8"/>
        <path d="M6 8a6 6 0 0 1 12 0v4a6 6 0 0 1-12 0V8z"/>
      </svg>
      Take a 5 Min Break
    `;
    cooldownText.textContent = '';
  } else {
    breakBtn.disabled = true;
    breakBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 3v18"/>
        <path d="M8 21h8"/>
        <path d="M8 3h8"/>
        <path d="M6 8a6 6 0 0 1 12 0v4a6 6 0 0 1-12 0V8z"/>
      </svg>
      Take a 5 Min Break
    `;
    cooldownText.textContent = `Available in ${status.breakCooldownRemaining} minutes`;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Back to work button - go back
  document.getElementById('backToWorkBtn').addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // If no history, close the tab or redirect to a productive site
      window.location.href = 'https://www.google.com';
    }
  });
  
  // Take break button
  document.getElementById('takeBreakBtn').addEventListener('click', takeBreak);
}

/**
 * Request a break from focus mode
 * @async
 */
async function takeBreak() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'takeBreak' });
    
    if (response.success) {
      showToast('Break started! Enjoy your 5 minutes.', 'success');
      await updateStatus();
      
      // Reload page after a short delay to allow break to take effect
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      showToast(response.error || 'Cannot take break now', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Blocked: Take break error:', error);
    showToast('Failed to start break', 'error');
  }
}

/**
 * Start timer updates
 */
function startTimerUpdates() {
  // Update immediately and then every 30 seconds
  updateStatus();
  setInterval(updateStatus, 30000);
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type ('success', 'error', or 'info')
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  
  toast.className = 'toast';
  if (type) {
    toast.classList.add(type);
  }
  
  toastMessage.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

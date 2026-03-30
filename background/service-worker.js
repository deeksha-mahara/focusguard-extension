/**
 * @fileoverview Service Worker for FocusGuard extension.
 * Handles background tasks including schedule checking, rule management, and alarms.
 * @module service-worker
 */

import {
  getConfig,
  getSchedules,
  getBlockedSites,
  setFocusMode,
  isFocusModeActive,
  getBreakData,
  updateBreakData
} from './storage.js';

import {
  isWithinSchedule,
  getTimeRemaining,
  canTakeBreak,
  getBreakCooldownRemaining
} from './utils.js';

import {
  applyBlockingRules,
  removeAllFocusGuardRules,
  refreshBlockingRules
} from './rules-manager.js';

/**
 * Alarm name for schedule checking
 * @constant {string}
 */
const SCHEDULE_CHECK_ALARM = 'focusguard-schedule-check';

/**
 * Alarm interval in minutes
 * @constant {number}
 */
const CHECK_INTERVAL_MINUTES = 1;

/**
 * Initialize the extension on install/update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('FocusGuard: Extension installed/updated', details.reason);
  
  // Initialize storage with defaults if needed
  await initializeStorage();
  
  // Set up alarm for schedule checking
  await setupScheduleAlarm();
  
  // Perform initial schedule check
  await checkScheduleAndUpdateRules();
});

/**
 * Initialize extension storage
 * @async
 */
async function initializeStorage() {
  try {
    const config = await getConfig();
    console.log('FocusGuard: Storage initialized', config);
  } catch (error) {
    console.error('FocusGuard: Failed to initialize storage:', error);
  }
}

/**
 * Set up the schedule checking alarm
 * @async
 */
async function setupScheduleAlarm() {
  try {
    // Clear any existing alarm
    await chrome.alarms.clear(SCHEDULE_CHECK_ALARM);
    
    // Create new alarm
    await chrome.alarms.create(SCHEDULE_CHECK_ALARM, {
      periodInMinutes: CHECK_INTERVAL_MINUTES
    });
    
    console.log('FocusGuard: Schedule alarm set up');
  } catch (error) {
    console.error('FocusGuard: Failed to set up alarm:', error);
  }
}

/**
 * Handle alarm events
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SCHEDULE_CHECK_ALARM) {
    await checkScheduleAndUpdateRules();
  }
});

/**
 * Check current schedule and update blocking rules accordingly
 * @async
 */
async function checkScheduleAndUpdateRules() {
  try {
    const config = await getConfig();
    const schedules = config.schedules || [];
    const blockedSites = config.blockedSites || [];
    const breakData = await getBreakData();
    
    // Check if we're currently on a break
    const onBreak = breakData.breakEndTime && new Date() < new Date(breakData.breakEndTime);
    
    if (onBreak) {
      // We're on a break, ensure rules are disabled
      const wasFocused = await isFocusModeActive();
      if (wasFocused) {
        await disableFocusMode();
      }
      return;
    }
    
    // Check if break just ended
    if (breakData.breakEndTime && new Date() >= new Date(breakData.breakEndTime)) {
      // Clear break data
      breakData.breakEndTime = null;
      await updateBreakData(breakData);
    }
    
    // Check if current time is within any schedule
    const shouldBeFocused = schedules.length > 0 && 
                           blockedSites.length > 0 && 
                           isWithinSchedule(schedules);
    
    const isCurrentlyFocused = await isFocusModeActive();
    
    if (shouldBeFocused && !isCurrentlyFocused) {
      // Enter focus mode
      await enableFocusMode();
    } else if (!shouldBeFocused && isCurrentlyFocused) {
      // Exit focus mode
      await disableFocusMode();
    }
    
    // Update extension icon/badge
    await updateExtensionBadge(shouldBeFocused);
    
  } catch (error) {
    console.error('FocusGuard: Error checking schedule:', error);
  }
}

/**
 * Enable focus mode and apply blocking rules
 * @async
 */
async function enableFocusMode() {
  try {
    console.log('FocusGuard: Enabling focus mode');
    
    // Apply blocking rules
    await refreshBlockingRules();
    
    // Set focus mode flag
    await setFocusMode(true);
    
    // Update badge
    await updateExtensionBadge(true);
    
    console.log('FocusGuard: Focus mode enabled');
  } catch (error) {
    console.error('FocusGuard: Failed to enable focus mode:', error);
  }
}

/**
 * Disable focus mode and remove blocking rules
 * @async
 */
async function disableFocusMode() {
  try {
    console.log('FocusGuard: Disabling focus mode');
    
    // Remove blocking rules
    await removeAllFocusGuardRules();
    
    // Clear focus mode flag
    await setFocusMode(false);
    
    // Update badge
    await updateExtensionBadge(false);
    
    console.log('FocusGuard: Focus mode disabled');
  } catch (error) {
    console.error('FocusGuard: Failed to disable focus mode:', error);
  }
}

/**
 * Update the extension badge based on focus state
 * @async
 * @param {boolean} isFocused - Whether focus mode is active
 */
async function updateExtensionBadge(isFocused) {
  try {
    if (isFocused) {
      await chrome.action.setBadgeText({ text: 'ON' });
      await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
      await chrome.action.setTitle({ title: 'FocusGuard - Focus Mode Active' });
    } else {
      await chrome.action.setBadgeText({ text: '' });
      await chrome.action.setTitle({ title: 'FocusGuard' });
    }
  } catch (error) {
    console.error('FocusGuard: Failed to update badge:', error);
  }
}

/**
 * Handle messages from popup and other extension pages
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle async operations
  handleMessage(message, sender, sendResponse);
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

/**
 * Handle incoming messages
 * @async
 * @param {Object} message - The message object
 * @param {Object} sender - The sender information
 * @param {Function} sendResponse - Callback to send response
 */
async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.action) {
      case 'getStatus':
        await handleGetStatus(sendResponse);
        break;
        
      case 'refreshRules':
        await handleRefreshRules(sendResponse);
        break;
        
      case 'takeBreak':
        await handleTakeBreak(sendResponse);
        break;
        
      case 'endBreak':
        await handleEndBreak(sendResponse);
        break;
        
      case 'checkSchedule':
        await checkScheduleAndUpdateRules();
        sendResponse({ success: true });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.error('FocusGuard: Message handler error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle get status request
 * @async
 * @param {Function} sendResponse - Response callback
 */
async function handleGetStatus(sendResponse) {
  try {
    const config = await getConfig();
    const isFocused = await isFocusModeActive();
    const breakData = await getBreakData();
    const timeRemaining = getTimeRemaining(config.schedules);
    
    // Check if on break
    const onBreak = breakData.breakEndTime && new Date() < new Date(breakData.breakEndTime);
    const breakTimeRemaining = onBreak 
      ? Math.ceil((new Date(breakData.breakEndTime) - new Date()) / (1000 * 60))
      : 0;
    
    sendResponse({
      success: true,
      data: {
        isFocused,
        onBreak,
        breakTimeRemaining,
        canTakeBreak: canTakeBreak(breakData),
        breakCooldownRemaining: getBreakCooldownRemaining(breakData),
        focusTimeRemaining: timeRemaining,
        blockedSitesCount: config.blockedSites?.length || 0,
        schedulesCount: config.schedules?.length || 0
      }
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle refresh rules request
 * @async
 * @param {Function} sendResponse - Response callback
 */
async function handleRefreshRules(sendResponse) {
  try {
    const success = await refreshBlockingRules();
    sendResponse({ success });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle take break request
 * @async
 * @param {Function} sendResponse - Response callback
 */
async function handleTakeBreak(sendResponse) {
  try {
    const breakData = await getBreakData();
    
    if (!canTakeBreak(breakData)) {
      sendResponse({
        success: false,
        error: 'Break cooldown not expired',
        cooldownRemaining: getBreakCooldownRemaining(breakData)
      });
      return;
    }
    
    // Set break end time (5 minutes from now)
    const breakDuration = 5; // minutes
    const breakEndTime = new Date(Date.now() + breakDuration * 60 * 1000);
    
    breakData.lastBreakTime = new Date().toISOString();
    breakData.breakEndTime = breakEndTime.toISOString();
    
    await updateBreakData(breakData);
    
    // Disable focus mode temporarily
    await disableFocusMode();
    
    sendResponse({
      success: true,
      data: {
        breakDuration,
        breakEndTime: breakEndTime.toISOString()
      }
    });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle end break request
 * @async
 * @param {Function} sendResponse - Response callback
 */
async function handleEndBreak(sendResponse) {
  try {
    const breakData = await getBreakData();
    breakData.breakEndTime = null;
    await updateBreakData(breakData);
    
    // Re-enable focus mode if within schedule
    await checkScheduleAndUpdateRules();
    
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle startup (browser restart)
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('FocusGuard: Browser started');
  await setupScheduleAlarm();
  await checkScheduleAndUpdateRules();
});

/**
 * Handle storage changes from other contexts
 */
chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && changes.focusguard_config) {
    console.log('FocusGuard: Config changed, refreshing rules');
    await checkScheduleAndUpdateRules();
  }
});

// Log service worker startup
console.log('FocusGuard: Service worker started');

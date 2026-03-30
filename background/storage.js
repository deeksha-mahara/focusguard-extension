/**
 * @fileoverview Storage module for FocusGuard extension.
 * Handles all Chrome Storage API operations with error handling.
 * @module storage
 */

/**
 * Default configuration for FocusGuard
 * @constant {Object}
 */
const DEFAULT_CONFIG = {
  blockedSites: [],
  schedules: [],
  theme: 'light',
  stats: {
    sitesBlocked: 0,
    timeSaved: 0,
    lastResetDate: new Date().toDateString()
  },
  breakData: {
    lastBreakTime: null,
    breakCooldownMinutes: 5
  }
};

/**
 * Storage keys used throughout the extension
 * @constant {Object}
 */
const STORAGE_KEYS = {
  CONFIG: 'focusguard_config',
  ACTIVE_RULES: 'focusguard_active_rules',
  IS_FOCUSED: 'focusguard_is_focused'
};

/**
 * Retrieves the entire configuration from storage
 * @async
 * @returns {Promise<Object>} The stored configuration or default config
 * @throws {Error} If storage operation fails
 */
async function getConfig() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.CONFIG);
    return result[STORAGE_KEYS.CONFIG] || { ...DEFAULT_CONFIG };
  } catch (error) {
    console.error('FocusGuard: Failed to get config:', error);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Saves the entire configuration to storage
 * @async
 * @param {Object} config - The configuration object to save
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function saveConfig(config) {
  try {
    await chrome.storage.sync.set({ [STORAGE_KEYS.CONFIG]: config });
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to save config:', error);
    return false;
  }
}

/**
 * Gets blocked sites list
 * @async
 * @returns {Promise<string[]>} Array of blocked site URLs
 */
async function getBlockedSites() {
  const config = await getConfig();
  return config.blockedSites || [];
}

/**
 * Adds a site to the blocked list
 * @async
 * @param {string} site - The site URL to block
 * @returns {Promise<boolean>} True if added successfully
 */
async function addBlockedSite(site) {
  try {
    const config = await getConfig();
    const normalizedSite = normalizeSite(site);
    
    if (!config.blockedSites.includes(normalizedSite)) {
      config.blockedSites.push(normalizedSite);
      await saveConfig(config);
    }
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to add blocked site:', error);
    return false;
  }
}

/**
 * Removes a site from the blocked list
 * @async
 * @param {string} site - The site URL to unblock
 * @returns {Promise<boolean>} True if removed successfully
 */
async function removeBlockedSite(site) {
  try {
    const config = await getConfig();
    const normalizedSite = normalizeSite(site);
    
    config.blockedSites = config.blockedSites.filter(s => s !== normalizedSite);
    await saveConfig(config);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to remove blocked site:', error);
    return false;
  }
}

/**
 * Gets all focus schedules
 * @async
 * @returns {Promise<Array>} Array of schedule objects
 */
async function getSchedules() {
  const config = await getConfig();
  return config.schedules || [];
}

/**
 * Adds a new focus schedule
 * @async
 * @param {Object} schedule - The schedule to add
 * @param {string} schedule.startTime - Start time in HH:MM format
 * @param {string} schedule.endTime - End time in HH:MM format
 * @param {number[]} schedule.days - Array of days (0-6, where 0 is Sunday)
 * @returns {Promise<boolean>} True if added successfully
 */
async function addSchedule(schedule) {
  try {
    const config = await getConfig();
    schedule.id = Date.now().toString();
    config.schedules.push(schedule);
    await saveConfig(config);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to add schedule:', error);
    return false;
  }
}

/**
 * Removes a schedule by ID
 * @async
 * @param {string} scheduleId - The ID of the schedule to remove
 * @returns {Promise<boolean>} True if removed successfully
 */
async function removeSchedule(scheduleId) {
  try {
    const config = await getConfig();
    config.schedules = config.schedules.filter(s => s.id !== scheduleId);
    await saveConfig(config);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to remove schedule:', error);
    return false;
  }
}

/**
 * Gets the current theme preference
 * @async
 * @returns {Promise<string>} 'light' or 'dark'
 */
async function getTheme() {
  const config = await getConfig();
  return config.theme || 'light';
}

/**
 * Sets the theme preference
 * @async
 * @param {string} theme - 'light' or 'dark'
 * @returns {Promise<boolean>} True if set successfully
 */
async function setTheme(theme) {
  try {
    const config = await getConfig();
    config.theme = theme;
    await saveConfig(config);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to set theme:', error);
    return false;
  }
}

/**
 * Gets statistics
 * @async
 * @returns {Promise<Object>} Statistics object
 */
async function getStats() {
  const config = await getConfig();
  const stats = config.stats || DEFAULT_CONFIG.stats;
  
  // Reset stats if it's a new day
  const today = new Date().toDateString();
  if (stats.lastResetDate !== today) {
    stats.sitesBlocked = 0;
    stats.timeSaved = 0;
    stats.lastResetDate = today;
    await updateStats(stats);
  }
  
  return stats;
}

/**
 * Updates statistics
 * @async
 * @param {Object} stats - The statistics to save
 * @returns {Promise<boolean>} True if updated successfully
 */
async function updateStats(stats) {
  try {
    const config = await getConfig();
    config.stats = stats;
    await saveConfig(config);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to update stats:', error);
    return false;
  }
}

/**
 * Increments the sites blocked counter
 * @async
 * @returns {Promise<boolean>} True if incremented successfully
 */
async function incrementBlockedCount() {
  try {
    const stats = await getStats();
    stats.sitesBlocked++;
    await updateStats(stats);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to increment blocked count:', error);
    return false;
  }
}

/**
 * Adds time saved (in minutes)
 * @async
 * @param {number} minutes - Minutes to add
 * @returns {Promise<boolean>} True if added successfully
 */
async function addTimeSaved(minutes) {
  try {
    const stats = await getStats();
    stats.timeSaved += minutes;
    await updateStats(stats);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to add time saved:', error);
    return false;
  }
}

/**
 * Gets break data
 * @async
 * @returns {Promise<Object>} Break data object
 */
async function getBreakData() {
  const config = await getConfig();
  return config.breakData || DEFAULT_CONFIG.breakData;
}

/**
 * Updates break data
 * @async
 * @param {Object} breakData - The break data to save
 * @returns {Promise<boolean>} True if updated successfully
 */
async function updateBreakData(breakData) {
  try {
    const config = await getConfig();
    config.breakData = breakData;
    await saveConfig(config);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to update break data:', error);
    return false;
  }
}

/**
 * Normalizes a site URL for consistent storage
 * @param {string} site - The site URL to normalize
 * @returns {string} Normalized site URL
 */
function normalizeSite(site) {
  let normalized = site.trim().toLowerCase();
  
  // Remove protocol
  normalized = normalized.replace(/^https?:\/\//, '');
  normalized = normalized.replace(/^www\./, '');
  
  // Remove path and query parameters
  normalized = normalized.split('/')[0];
  
  return normalized;
}

/**
 * Checks if currently in focus mode
 * @async
 * @returns {Promise<boolean>} True if focus mode is active
 */
async function isFocusModeActive() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.IS_FOCUSED);
    return result[STORAGE_KEYS.IS_FOCUSED] || false;
  } catch (error) {
    console.error('FocusGuard: Failed to check focus mode:', error);
    return false;
  }
}

/**
 * Sets focus mode state
 * @async
 * @param {boolean} isActive - Whether focus mode should be active
 * @returns {Promise<boolean>} True if set successfully
 */
async function setFocusMode(isActive) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.IS_FOCUSED]: isActive });
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to set focus mode:', error);
    return false;
  }
}

// Export for use in other modules
export {
  getConfig,
  saveConfig,
  getBlockedSites,
  addBlockedSite,
  removeBlockedSite,
  getSchedules,
  addSchedule,
  removeSchedule,
  getTheme,
  setTheme,
  getStats,
  updateStats,
  incrementBlockedCount,
  addTimeSaved,
  getBreakData,
  updateBreakData,
  normalizeSite,
  isFocusModeActive,
  setFocusMode,
  STORAGE_KEYS,
  DEFAULT_CONFIG
};

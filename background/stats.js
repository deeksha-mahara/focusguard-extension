/**
 * @fileoverview Weekly Analytics module for FocusGuard extension.
 * Handles daily and weekly statistics tracking using chrome.storage.local.
 * @module stats
 */

/**
 * Storage key for analytics data
 * @constant {string}
 */
const ANALYTICS_STORAGE_KEY = 'focusguard_analytics';

/**
 * Minutes saved per blocked attempt
 * @constant {number}
 */
const TIME_SAVED_PER_BLOCK = 5;

/**
 * Number of days in a week for stats
 * @constant {number}
 */
const WEEK_DAYS = 7;

/**
 * Gets today's date key in YYYY-MM-DD format
 * @returns {string} Date key for today
 */
function getTodayKey() {
  const now = new Date();
  return formatDateKey(now);
}

/**
 * Formats a Date object to YYYY-MM-DD string
 * @param {Date} date - Date to format
 * @returns {string} Formatted date key
 */
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets the date key for a specific number of days ago
 * @param {number} daysAgo - Number of days ago (0 = today)
 * @returns {string} Date key
 */
function getDateKeyDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return formatDateKey(date);
}

/**
 * Gets all analytics data from storage
 * @async
 * @returns {Promise<Object>} Analytics data object
 */
async function getAnalyticsData() {
  try {
    const result = await chrome.storage.local.get(ANALYTICS_STORAGE_KEY);
    return result[ANALYTICS_STORAGE_KEY] || { stats: {} };
  } catch (error) {
    console.error('FocusGuard Stats: Failed to get analytics data:', error);
    return { stats: {} };
  }
}

/**
 * Saves analytics data to storage
 * @async
 * @param {Object} data - Analytics data to save
 * @returns {Promise<boolean>} True if saved successfully
 */
async function saveAnalyticsData(data) {
  try {
    await chrome.storage.local.set({ [ANALYTICS_STORAGE_KEY]: data });
    return true;
  } catch (error) {
    console.error('FocusGuard Stats: Failed to save analytics data:', error);
    return false;
  }
}

/**
 * Gets or creates daily stats for a specific date
 * @param {Object} analyticsData - Full analytics data object
 * @param {string} dateKey - Date key in YYYY-MM-DD format
 * @returns {Object} Daily stats object with blockedCount and timeSaved
 */
function getOrCreateDailyStats(analyticsData, dateKey) {
  if (!analyticsData.stats) {
    analyticsData.stats = {};
  }
  
  if (!analyticsData.stats[dateKey]) {
    analyticsData.stats[dateKey] = {
      blockedCount: 0,
      timeSaved: 0
    };
  }
  
  return analyticsData.stats[dateKey];
}

/**
 * Updates daily stats by incrementing blocked count and time saved
 * @async
 * @param {number} [blocks=1] - Number of blocks to add (default 1)
 * @returns {Promise<Object|null>} Updated daily stats or null on error
 */
async function updateDailyStats(blocks = 1) {
  try {
    const analyticsData = await getAnalyticsData();
    const todayKey = getTodayKey();
    const dailyStats = getOrCreateDailyStats(analyticsData, todayKey);
    
    // Increment stats
    dailyStats.blockedCount += blocks;
    dailyStats.timeSaved += blocks * TIME_SAVED_PER_BLOCK;
    
    // Save updated data
    const success = await saveAnalyticsData(analyticsData);
    
    if (success) {
      console.log('FocusGuard Stats: Updated daily stats', dailyStats);
      return dailyStats;
    }
    
    return null;
  } catch (error) {
    console.error('FocusGuard Stats: Failed to update daily stats:', error);
    return null;
  }
}

/**
 * Gets stats for a specific date
 * @async
 * @param {string} dateKey - Date key in YYYY-MM-DD format
 * @returns {Promise<Object>} Daily stats with blockedCount and timeSaved
 */
async function getDailyStats(dateKey) {
  try {
    const analyticsData = await getAnalyticsData();
    return analyticsData.stats?.[dateKey] || { blockedCount: 0, timeSaved: 0 };
  } catch (error) {
    console.error('FocusGuard Stats: Failed to get daily stats:', error);
    return { blockedCount: 0, timeSaved: 0 };
  }
}

/**
 * Gets today's stats
 * @async
 * @returns {Promise<Object>} Today's stats
 */
async function getTodayStats() {
  return getDailyStats(getTodayKey());
}

/**
 * Gets weekly stats for the last 7 days
 * @async
 * @returns {Promise<Object>} Weekly stats object
 */
async function getWeeklyStats() {
  try {
    const analyticsData = await getAnalyticsData();
    const weeklyData = [];
    let totalBlocked = 0;
    let totalTimeSaved = 0;
    
    // Get stats for last 7 days (today + 6 previous days)
    for (let i = 6; i >= 0; i--) {
      const dateKey = getDateKeyDaysAgo(i);
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const dayStats = analyticsData.stats?.[dateKey] || { blockedCount: 0, timeSaved: 0 };
      
      weeklyData.push({
        dateKey,
        date: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        shortDay: date.toLocaleDateString('en-US', { weekday: 'short' }),
        blockedCount: dayStats.blockedCount,
        timeSaved: dayStats.timeSaved
      });
      
      totalBlocked += dayStats.blockedCount;
      totalTimeSaved += dayStats.timeSaved;
    }
    
    return {
      days: weeklyData,
      totalBlocked,
      totalTimeSaved,
      averageBlocked: Math.round(totalBlocked / 7),
      averageTimeSaved: Math.round(totalTimeSaved / 7)
    };
  } catch (error) {
    console.error('FocusGuard Stats: Failed to get weekly stats:', error);
    return {
      days: [],
      totalBlocked: 0,
      totalTimeSaved: 0,
      averageBlocked: 0,
      averageTimeSaved: 0
    };
  }
}

/**
 * Gets stats for a custom date range
 * @async
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Stats for the date range
 */
async function getStatsForRange(days) {
  try {
    const analyticsData = await getAnalyticsData();
    const rangeData = [];
    let totalBlocked = 0;
    let totalTimeSaved = 0;
    
    for (let i = days - 1; i >= 0; i--) {
      const dateKey = getDateKeyDaysAgo(i);
      const dayStats = analyticsData.stats?.[dateKey] || { blockedCount: 0, timeSaved: 0 };
      
      rangeData.push({
        dateKey,
        blockedCount: dayStats.blockedCount,
        timeSaved: dayStats.timeSaved
      });
      
      totalBlocked += dayStats.blockedCount;
      totalTimeSaved += dayStats.timeSaved;
    }
    
    return {
      days: rangeData,
      totalBlocked,
      totalTimeSaved
    };
  } catch (error) {
    console.error('FocusGuard Stats: Failed to get range stats:', error);
    return {
      days: [],
      totalBlocked: 0,
      totalTimeSaved: 0
    };
  }
}

/**
 * Cleans up old stats data (keeps last 90 days)
 * @async
 * @param {number} [keepDays=90] - Number of days to keep
 * @returns {Promise<boolean>} True if cleanup successful
 */
async function cleanupOldStats(keepDays = 90) {
  try {
    const analyticsData = await getAnalyticsData();
    
    if (!analyticsData.stats) {
      return true;
    }
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepDays);
    const cutoffKey = formatDateKey(cutoffDate);
    
    const newStats = {};
    
    for (const [dateKey, stats] of Object.entries(analyticsData.stats)) {
      if (dateKey >= cutoffKey) {
        newStats[dateKey] = stats;
      }
    }
    
    analyticsData.stats = newStats;
    await saveAnalyticsData(analyticsData);
    
    console.log('FocusGuard Stats: Cleaned up old stats data');
    return true;
  } catch (error) {
    console.error('FocusGuard Stats: Failed to cleanup old stats:', error);
    return false;
  }
}

/**
 * Validates and repairs corrupted analytics data
 * @async
 * @returns {Promise<boolean>} True if data is valid or was repaired
 */
async function validateAndRepairStats() {
  try {
    const analyticsData = await getAnalyticsData();
    let needsRepair = false;
    
    // Check if stats object exists
    if (!analyticsData.stats || typeof analyticsData.stats !== 'object') {
      analyticsData.stats = {};
      needsRepair = true;
    }
    
    // Validate each day's stats
    for (const [dateKey, dayStats] of Object.entries(analyticsData.stats)) {
      // Validate date key format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        delete analyticsData.stats[dateKey];
        needsRepair = true;
        continue;
      }
      
      // Validate stats structure
      if (typeof dayStats !== 'object') {
        analyticsData.stats[dateKey] = { blockedCount: 0, timeSaved: 0 };
        needsRepair = true;
        continue;
      }
      
      // Ensure numeric values
      if (typeof dayStats.blockedCount !== 'number' || isNaN(dayStats.blockedCount)) {
        dayStats.blockedCount = 0;
        needsRepair = true;
      }
      
      if (typeof dayStats.timeSaved !== 'number' || isNaN(dayStats.timeSaved)) {
        dayStats.timeSaved = 0;
        needsRepair = true;
      }
    }
    
    if (needsRepair) {
      await saveAnalyticsData(analyticsData);
      console.log('FocusGuard Stats: Repaired corrupted data');
    }
    
    return true;
  } catch (error) {
    console.error('FocusGuard Stats: Failed to validate/repair stats:', error);
    return false;
  }
}

/**
 * Formats minutes into human-readable duration
 * @param {number} minutes - Minutes to format
 * @returns {string} Formatted duration (e.g., "2h 30m" or "45m")
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Gets the maximum blocked count from weekly data (for chart scaling)
 * @param {Array} weeklyData - Array of daily stats
 * @returns {number} Maximum blocked count (minimum 1)
 */
function getMaxBlockedForChart(weeklyData) {
  if (!weeklyData || weeklyData.length === 0) {
    return 1;
  }
  const max = Math.max(...weeklyData.map(d => d.blockedCount));
  return max > 0 ? max : 1;
}

// Export for use in other modules
export {
  getTodayKey,
  formatDateKey,
  getDateKeyDaysAgo,
  getAnalyticsData,
  saveAnalyticsData,
  getOrCreateDailyStats,
  updateDailyStats,
  getDailyStats,
  getTodayStats,
  getWeeklyStats,
  getStatsForRange,
  cleanupOldStats,
  validateAndRepairStats,
  formatDuration,
  getMaxBlockedForChart,
  ANALYTICS_STORAGE_KEY,
  TIME_SAVED_PER_BLOCK,
  WEEK_DAYS
};

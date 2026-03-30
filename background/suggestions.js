/**
 * @fileoverview Smart Suggestion System for FocusGuard extension.
 * Analyzes user behavior analytics and generates human-readable productivity suggestions.
 * Uses rule-based logic to provide personalized insights.
 * @module suggestions
 */

/**
 * Threshold for high distraction level (blocks per week)
 * @constant {number}
 */
const HIGH_DISTRACTION_THRESHOLD = 50;

/**
 * Threshold for low distraction level (blocks per week)
 * @constant {number}
 */
const LOW_DISTRACTION_THRESHOLD = 10;

/**
 * Threshold for night-time distraction analysis (10 PM)
 * @constant {number}
 */
const NIGHT_TIME_HOUR = 22;

/**
 * Minimum percentage of night blocks to trigger suggestion
 * @constant {number}
 */
const NIGHT_BLOCKS_PERCENTAGE = 40;

/**
 * Days in a week for averaging
 * @constant {number}
 */
const DAYS_IN_WEEK = 7;

/**
 * Suggestion types with their icons and colors
 * @constant {Object}
 */
const SUGGESTION_TYPES = {
  WARNING: {
    icon: 'alert-triangle',
    color: 'warning'
  },
  TIP: {
    icon: 'lightbulb',
    color: 'info'
  },
  SUCCESS: {
    icon: 'check-circle',
    color: 'success'
  },
  INSIGHT: {
    icon: 'trending-up',
    color: 'primary'
  }
};

/**
 * Generates smart suggestions based on weekly analytics data
 * @async
 * @param {Object} weeklyStats - Weekly stats object from stats.js
 * @returns {Promise<Array>} Array of suggestion objects
 */
async function generateSuggestions(weeklyStats) {
  try {
    const suggestions = [];
    
    // Validate input data
    if (!weeklyStats || !weeklyStats.days || weeklyStats.days.length === 0) {
      return [getDefaultSuggestion()];
    }
    
    // Analyze distraction level
    const distractionSuggestion = analyzeDistractionLevel(weeklyStats);
    if (distractionSuggestion) {
      suggestions.push(distractionSuggestion);
    }
    
    // Analyze time patterns
    const timePatternSuggestion = analyzeTimePatterns(weeklyStats);
    if (timePatternSuggestion) {
      suggestions.push(timePatternSuggestion);
    }
    
    // Analyze consistency
    const consistencySuggestion = analyzeConsistency(weeklyStats);
    if (consistencySuggestion) {
      suggestions.push(consistencySuggestion);
    }
    
    // Analyze trends (compare to previous week if available)
    const trendSuggestion = analyzeTrends(weeklyStats);
    if (trendSuggestion) {
      suggestions.push(trendSuggestion);
    }
    
    // If no specific suggestions generated, add a default one
    if (suggestions.length === 0) {
      suggestions.push(getDefaultSuggestion());
    }
    
    // Limit to top 3 most relevant suggestions
    return suggestions.slice(0, 3);
    
  } catch (error) {
    console.error('FocusGuard Suggestions: Failed to generate suggestions:', error);
    return [getDefaultSuggestion()];
  }
}

/**
 * Analyzes overall distraction level and generates appropriate suggestion
 * @param {Object} weeklyStats - Weekly stats object
 * @returns {Object|null} Suggestion object or null if no suggestion needed
 */
function analyzeDistractionLevel(weeklyStats) {
  const totalBlocked = weeklyStats.totalBlocked || 0;
  
  // High distraction detected
  if (totalBlocked > HIGH_DISTRACTION_THRESHOLD) {
    return {
      type: 'WARNING',
      title: 'High Distraction Detected',
      message: `You've been blocked ${totalBlocked} times this week. Consider enabling stricter focus hours or adding more distracting sites to your block list.`,
      action: 'Review your schedule and blocked sites to strengthen your focus protection.',
      priority: 1
    };
  }
  
  // Very low distraction - positive reinforcement
  if (totalBlocked > 0 && totalBlocked < LOW_DISTRACTION_THRESHOLD) {
    return {
      type: 'SUCCESS',
      title: 'Excellent Focus!',
      message: 'Great job maintaining focus this week. Your distraction management is working well.',
      action: 'Keep up the good work! Consider sharing your productivity tips.',
      priority: 3
    };
  }
  
  // No blocks at all - might need to check if extension is working
  if (totalBlocked === 0) {
    return {
      type: 'TIP',
      title: 'Getting Started',
      message: 'No distractions blocked yet. Make sure you have sites added to your block list and schedules set up.',
      action: 'Add distracting websites and set your focus hours to get started.',
      priority: 2
    };
  }
  
  return null;
}

/**
 * Analyzes time patterns to identify when user is most distracted
 * @param {Object} weeklyStats - Weekly stats object
 * @returns {Object|null} Suggestion object or null if no pattern detected
 */
function analyzeTimePatterns(weeklyStats) {
  // Since we don't track exact time of each block, we'll use a heuristic:
  // If user has evening/night schedules, they might be more distracted then
  // For now, we'll provide a general tip about evening productivity
  
  const days = weeklyStats.days || [];
  const activeDays = days.filter(d => d.blockedCount > 0);
  
  if (activeDays.length === 0) {
    return null;
  }
  
  // Check if blocks are concentrated on specific days (weekend vs weekday pattern)
  const weekendDays = activeDays.filter(d => {
    const dayOfWeek = new Date(d.dateKey).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  });
  
  const weekdayDays = activeDays.filter(d => {
    const dayOfWeek = new Date(d.dateKey).getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
  });
  
  // If more blocks on weekends, suggest weekday focus
  if (weekendDays.length > weekdayDays.length && weekendDays.length >= 2) {
    const weekendBlocks = weekendDays.reduce((sum, d) => sum + d.blockedCount, 0);
    const weekdayBlocks = weekdayDays.reduce((sum, d) => sum + d.blockedCount, 0);
    
    if (weekendBlocks > weekdayBlocks) {
      return {
        type: 'INSIGHT',
        title: 'Weekend Distraction Pattern',
        message: 'You seem more distracted on weekends. Consider setting different focus hours for weekends vs weekdays.',
        action: 'Create separate schedules for weekdays and weekends.',
        priority: 2
      };
    }
  }
  
  // General evening productivity tip (based on common patterns)
  const avgBlocksPerDay = (weeklyStats.totalBlocked || 0) / DAYS_IN_WEEK;
  
  if (avgBlocksPerDay > 5) {
    return {
      type: 'TIP',
      title: 'Evening Focus Tip',
      message: 'Many people find evenings challenging for focus. Consider setting stricter blocks after 10 PM when willpower is lower.',
      action: 'Add a schedule that ends at 10 PM or later to protect your evening focus.',
      priority: 3
    };
  }
  
  return null;
}

/**
 * Analyzes consistency of focus habits
 * @param {Object} weeklyStats - Weekly stats object
 * @returns {Object|null} Suggestion object or null if no suggestion needed
 */
function analyzeConsistency(weeklyStats) {
  const days = weeklyStats.days || [];
  
  // Count days with blocks vs days without
  const daysWithBlocks = days.filter(d => d.blockedCount > 0).length;
  const daysWithoutBlocks = days.length - daysWithBlocks;
  
  // If user has blocks every single day, they might need more protection
  if (daysWithBlocks === DAYS_IN_WEEK && weeklyStats.totalBlocked > 20) {
    return {
      type: 'WARNING',
      title: 'Daily Distraction Struggle',
      message: 'You\'ve been distracted every day this week. Consider reviewing your blocked sites and extending focus hours.',
      action: 'Try adding more sites to your block list or extending your focus schedule.',
      priority: 1
    };
  }
  
  // If user has some days with zero blocks, that's good consistency
  if (daysWithoutBlocks >= 2 && weeklyStats.totalBlocked > 0) {
    return {
      type: 'SUCCESS',
      title: 'Balanced Focus Days',
      message: `You had ${daysWithoutBlocks} distraction-free days this week. Great job maintaining focus on those days!`,
      action: 'Try to identify what worked on those days and replicate it.',
      priority: 3
    };
  }
  
  // Check for spikes (one day with significantly more blocks)
  const maxBlocks = Math.max(...days.map(d => d.blockedCount));
  const avgBlocks = weeklyStats.totalBlocked / DAYS_IN_WEEK;
  
  if (maxBlocks > avgBlocks * 2 && maxBlocks > 10) {
    const spikeDay = days.find(d => d.blockedCount === maxBlocks);
    const dayName = spikeDay ? spikeDay.shortDay : 'one day';
    
    return {
      type: 'INSIGHT',
      title: 'Distraction Spike Detected',
      message: `You had ${maxBlocks} blocks on ${dayName}, significantly more than your daily average. Something might have triggered extra distractions.`,
      action: 'Reflect on what happened that day and consider preventive measures.',
      priority: 2
    };
  }
  
  return null;
}

/**
 * Analyzes trends by comparing current week to patterns
 * @param {Object} weeklyStats - Weekly stats object
 * @returns {Object|null} Suggestion object or null if no trend detected
 */
function analyzeTrends(weeklyStats) {
  const days = weeklyStats.days || [];
  
  // Check for improving trend (blocks decreasing over the week)
  if (days.length >= 3) {
    const firstHalf = days.slice(0, Math.floor(days.length / 2));
    const secondHalf = days.slice(Math.floor(days.length / 2));
    
    const firstHalfBlocks = firstHalf.reduce((sum, d) => sum + d.blockedCount, 0);
    const secondHalfBlocks = secondHalf.reduce((sum, d) => sum + d.blockedCount, 0);
    
    // Improving trend
    if (secondHalfBlocks < firstHalfBlocks * 0.7 && secondHalfBlocks > 0) {
      return {
        type: 'SUCCESS',
        title: 'Improving Trend!',
        message: 'Your distractions are decreasing as the week progresses. You\'re building better habits!',
        action: 'Keep up the momentum! Consider what\'s working and maintain it.',
        priority: 3
      };
    }
    
    // Declining trend
    if (secondHalfBlocks > firstHalfBlocks * 1.5) {
      return {
        type: 'WARNING',
        title: 'Focus Declining',
        message: 'Your distractions increased in the second half of the week. Fatigue might be setting in.',
        action: 'Take a break, review your schedule, and ensure you\'re getting enough rest.',
        priority: 2
      };
    }
  }
  
  return null;
}

/**
 * Returns a default suggestion when no specific patterns are detected
 * @returns {Object} Default suggestion object
 */
function getDefaultSuggestion() {
  const defaultSuggestions = [
    {
      type: 'TIP',
      title: 'Productivity Tip',
      message: 'Try the Pomodoro Technique: 25 minutes of focused work followed by a 5-minute break.',
      action: 'Use FocusGuard to block distractions during your focused work sessions.',
      priority: 3
    },
    {
      type: 'TIP',
      title: 'Schedule Review',
      message: 'Regularly review and update your blocked sites list to match your current distractions.',
      action: 'Check your Stats tab weekly to see which sites you\'ve been trying to visit most.',
      priority: 3
    },
    {
      type: 'INSIGHT',
      title: 'Focus Habit',
      message: 'Consistency is key. Try to maintain similar focus hours each day to build a routine.',
      action: 'Set up recurring schedules that align with your most productive hours.',
      priority: 3
    }
  ];
  
  // Return a random default suggestion
  return defaultSuggestions[Math.floor(Math.random() * defaultSuggestions.length)];
}

/**
 * Gets the icon SVG for a suggestion type
 * @param {string} type - Suggestion type
 * @returns {string} SVG string for the icon
 */
function getSuggestionIcon(type) {
  const icons = {
    'alert-triangle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`,
    'lightbulb': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18h6M10 22h4"/>
      <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/>
    </svg>`,
    'check-circle': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`,
    'trending-up': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>`
  };
  
  const typeConfig = SUGGESTION_TYPES[type];
  return icons[typeConfig?.icon] || icons['lightbulb'];
}

/**
 * Gets the color class for a suggestion type
 * @param {string} type - Suggestion type
 * @returns {string} CSS color class
 */
function getSuggestionColor(type) {
  const typeConfig = SUGGESTION_TYPES[type];
  return typeConfig?.color || 'info';
}

/**
 * Formats a suggestion for display
 * @param {Object} suggestion - Suggestion object
 * @returns {Object} Formatted suggestion with icon and color
 */
function formatSuggestionForDisplay(suggestion) {
  return {
    ...suggestion,
    icon: getSuggestionIcon(suggestion.type),
    colorClass: getSuggestionColor(suggestion.type)
  };
}

/**
 * Gets quick stats summary for the suggestion system
 * @async
 * @returns {Promise<Object>} Quick stats summary
 */
async function getQuickStatsSummary() {
  try {
    // Import stats module dynamically
    const stats = await import(chrome.runtime.getURL('background/stats.js'));
    const weeklyStats = await stats.getWeeklyStats();
    
    return {
      totalBlocked: weeklyStats.totalBlocked,
      totalTimeSaved: weeklyStats.totalTimeSaved,
      dailyAverage: Math.round(weeklyStats.totalBlocked / 7),
      activeDays: weeklyStats.days.filter(d => d.blockedCount > 0).length
    };
  } catch (error) {
    console.error('FocusGuard Suggestions: Failed to get quick stats:', error);
    return null;
  }
}

// Export for use in other modules
export {
  generateSuggestions,
  analyzeDistractionLevel,
  analyzeTimePatterns,
  analyzeConsistency,
  analyzeTrends,
  getDefaultSuggestion,
  getSuggestionIcon,
  getSuggestionColor,
  formatSuggestionForDisplay,
  getQuickStatsSummary,
  HIGH_DISTRACTION_THRESHOLD,
  LOW_DISTRACTION_THRESHOLD,
  SUGGESTION_TYPES
};

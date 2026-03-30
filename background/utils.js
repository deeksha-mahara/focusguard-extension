/**
 * @fileoverview Utility functions for FocusGuard extension.
 * @module utils
 */

/**
 * Array of motivational quotes displayed on blocked page
 * @constant {string[]}
 */
const MOTIVATIONAL_QUOTES = [
  "The only way to do great work is to love what you do. - Steve Jobs",
  "Focus on being productive instead of busy. - Tim Ferriss",
  "Your future is created by what you do today, not tomorrow. - Robert Kiyosaki",
  "Success is the sum of small efforts repeated day in and day out. - Robert Collier",
  "Don't watch the clock; do what it does. Keep going. - Sam Levenson",
  "The secret of getting ahead is getting started. - Mark Twain",
  "It always seems impossible until it's done. - Nelson Mandela",
  "Believe you can and you're halfway there. - Theodore Roosevelt",
  "The best way to predict the future is to create it. - Peter Drucker",
  "Your time is limited, don't waste it living someone else's life. - Steve Jobs",
  "Discipline is the bridge between goals and accomplishment. - Jim Rohn",
  "The difference between ordinary and extraordinary is that little extra. - Jimmy Johnson",
  "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
  "The only limit to our realization of tomorrow will be our doubts of today. - Franklin D. Roosevelt",
  "What you do today can improve all your tomorrows. - Ralph Marston",
  "Small progress is still progress. Keep going!",
  "Every expert was once a beginner. Keep learning!",
  "The pain of discipline is nothing like the pain of disappointment. - Justin Langer",
  "You don't have to be great to start, but you have to start to be great. - Zig Ziglar",
  "Dream big and dare to fail. - Norman Vaughan"
];

/**
 * Days of the week for schedule display
 * @constant {string[]}
 */
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Gets a random motivational quote
 * @returns {string} A random quote from the collection
 */
function getRandomQuote() {
  const index = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  return MOTIVATIONAL_QUOTES[index];
}

/**
 * Checks if current time falls within any active schedule
 * @param {Array} schedules - Array of schedule objects
 * @returns {boolean} True if current time is within an active schedule
 */
function isWithinSchedule(schedules) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = formatTime(now.getHours(), now.getMinutes());
  
  return schedules.some(schedule => {
    // Check if today is in the schedule's days
    if (!schedule.days.includes(currentDay)) {
      return false;
    }
    
    // Check if current time is within the schedule
    return isTimeInRange(currentTime, schedule.startTime, schedule.endTime);
  });
}

/**
 * Checks if a given time falls within a time range
 * @param {string} currentTime - Current time in HH:MM format
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @returns {boolean} True if current time is within range
 */
function isTimeInRange(currentTime, startTime, endTime) {
  const current = timeToMinutes(currentTime);
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  
  // Handle schedules that span midnight
  if (end < start) {
    return current >= start || current <= end;
  }
  
  return current >= start && current <= end;
}

/**
 * Converts time string to minutes since midnight
 * @param {string} time - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Formats hours and minutes to HH:MM string
 * @param {number} hours - Hours (0-23)
 * @param {number} minutes - Minutes (0-59)
 * @returns {string} Formatted time string
 */
function formatTime(hours, minutes) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Gets current time formatted as HH:MM
 * @returns {string} Current time in HH:MM format
 */
function getCurrentTime() {
  const now = new Date();
  return formatTime(now.getHours(), now.getMinutes());
}

/**
 * Calculates time remaining until end of current focus session
 * @param {Array} schedules - Array of schedule objects
 * @returns {number|null} Minutes remaining, or null if not in focus mode
 */
function getTimeRemaining(schedules) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentTime = formatTime(now.getHours(), now.getMinutes());
  const currentMinutes = timeToMinutes(currentTime);
  
  for (const schedule of schedules) {
    if (!schedule.days.includes(currentDay)) {
      continue;
    }
    
    const startMinutes = timeToMinutes(schedule.startTime);
    const endMinutes = timeToMinutes(schedule.endTime);
    
    // Handle schedules that span midnight
    if (endMinutes < startMinutes) {
      if (currentMinutes >= startMinutes) {
        // Before midnight portion
        return (24 * 60 - currentMinutes) + endMinutes;
      } else if (currentMinutes <= endMinutes) {
        // After midnight portion
        return endMinutes - currentMinutes;
      }
    } else {
      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        return endMinutes - currentMinutes;
      }
    }
  }
  
  return null;
}

/**
 * Formats minutes into human-readable duration
 * @param {number} minutes - Minutes to format
 * @returns {string} Formatted duration (e.g., "1h 30m" or "45m")
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
 * Checks if break cooldown has expired
 * @param {Object} breakData - Break data from storage
 * @returns {boolean} True if break can be taken
 */
function canTakeBreak(breakData) {
  if (!breakData.lastBreakTime) {
    return true;
  }
  
  const lastBreak = new Date(breakData.lastBreakTime);
  const now = new Date();
  const diffMinutes = (now - lastBreak) / (1000 * 60);
  
  return diffMinutes >= breakData.breakCooldownMinutes;
}

/**
 * Gets remaining cooldown time in minutes
 * @param {Object} breakData - Break data from storage
 * @returns {number} Minutes until break is available (0 if available now)
 */
function getBreakCooldownRemaining(breakData) {
  if (!breakData.lastBreakTime) {
    return 0;
  }
  
  const lastBreak = new Date(breakData.lastBreakTime);
  const now = new Date();
  const diffMinutes = (now - lastBreak) / (1000 * 60);
  const remaining = breakData.breakCooldownMinutes - diffMinutes;
  
  return Math.max(0, Math.ceil(remaining));
}

/**
 * Validates a site URL format
 * @param {string} site - Site URL to validate
 * @returns {boolean} True if valid
 */
function isValidSite(site) {
  if (!site || typeof site !== 'string') {
    return false;
  }
  
  const trimmed = site.trim();
  if (trimmed.length === 0) {
    return false;
  }
  
  // Basic validation - must contain a dot and no spaces
  if (!trimmed.includes('.') || trimmed.includes(' ')) {
    return false;
  }
  
  return true;
}

/**
 * Validates a schedule object
 * @param {Object} schedule - Schedule to validate
 * @returns {boolean} True if valid
 */
function isValidSchedule(schedule) {
  if (!schedule || typeof schedule !== 'object') {
    return false;
  }
  
  // Check required fields
  if (!schedule.startTime || !schedule.endTime) {
    return false;
  }
  
  // Validate time format (HH:MM)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(schedule.startTime) || !timeRegex.test(schedule.endTime)) {
    return false;
  }
  
  // Check days array
  if (!Array.isArray(schedule.days) || schedule.days.length === 0) {
    return false;
  }
  
  // Validate day values (0-6)
  if (!schedule.days.every(day => day >= 0 && day <= 6)) {
    return false;
  }
  
  return true;
}

/**
 * Generates a unique ID
 * @returns {string} Unique identifier
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Debounces a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Formats a date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

// Export for use in other modules
export {
  MOTIVATIONAL_QUOTES,
  DAYS_OF_WEEK,
  getRandomQuote,
  isWithinSchedule,
  isTimeInRange,
  timeToMinutes,
  formatTime,
  getCurrentTime,
  getTimeRemaining,
  formatDuration,
  canTakeBreak,
  getBreakCooldownRemaining,
  isValidSite,
  isValidSchedule,
  generateId,
  debounce,
  formatDate
};

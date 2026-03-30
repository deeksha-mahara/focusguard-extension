/**
 * @fileoverview Popup script for FocusGuard extension.
 * Handles all popup UI interactions and state management.
 * @module popup
 */

// Import storage functions (using dynamic import for ES modules)
let storage = null;
let utils = null;
let stats = null;

/**
 * Initialize popup
 * @async
 */
async function init() {
  try {
    // Load modules
    storage = await import(chrome.runtime.getURL('background/storage.js'));
    utils = await import(chrome.runtime.getURL('background/utils.js'));
    stats = await import(chrome.runtime.getURL('background/stats.js'));
    
    // Initialize theme
    await initTheme();
    
    // Load initial data
    await loadData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start status polling
    startStatusPolling();
    
  } catch (error) {
    console.error('FocusGuard Popup: Initialization error:', error);
    showToast('Failed to initialize', 'error');
  }
}

/**
 * Initialize theme
 * @async
 */
async function initTheme() {
  try {
    const theme = await storage.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
  } catch (error) {
    console.error('FocusGuard Popup: Theme init error:', error);
  }
}

/**
 * Load all data from storage
 * @async
 */
async function loadData() {
  try {
    // Load sites
    const sites = await storage.getBlockedSites();
    renderSites(sites);
    
    // Load schedules
    const schedules = await storage.getSchedules();
    renderSchedules(schedules);
    
    // Load stats
    const legacyStats = await storage.getStats();
    renderStats(legacyStats);
    
    // Load weekly analytics
    await renderWeeklyAnalytics();
    
    // Load status
    await updateStatus();
    
  } catch (error) {
    console.error('FocusGuard Popup: Load data error:', error);
  }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Add site
  document.getElementById('addSiteBtn').addEventListener('click', addSite);
  document.getElementById('siteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSite();
  });
  
  // Day selection
  document.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleDaySelection(btn));
  });
  
  // Add schedule
  document.getElementById('addScheduleBtn').addEventListener('click', addSchedule);
  
  // Dashboard link
  document.getElementById('dashboardLink').addEventListener('click', openDashboard);
}

/**
 * Toggle theme between light and dark
 * @async
 */
async function toggleTheme() {
  try {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    await storage.setTheme(newTheme);
    
  } catch (error) {
    console.error('FocusGuard Popup: Toggle theme error:', error);
  }
}

/**
 * Switch between tabs
 * @param {string} tabName - Name of tab to switch to
 */
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tabName}Tab`).classList.add('active');
}

/**
 * Add a new blocked site
 * @async
 */
async function addSite() {
  try {
    const input = document.getElementById('siteInput');
    const site = input.value.trim();
    
    if (!site) {
      showToast('Please enter a website', 'error');
      return;
    }
    
    if (!utils.isValidSite(site)) {
      showToast('Please enter a valid website URL', 'error');
      return;
    }
    
    const success = await storage.addBlockedSite(site);
    
    if (success) {
      input.value = '';
      const sites = await storage.getBlockedSites();
      renderSites(sites);
      showToast('Website added successfully', 'success');
      
      // Notify background to refresh rules
      await chrome.runtime.sendMessage({ action: 'refreshRules' });
    } else {
      showToast('Failed to add website', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Popup: Add site error:', error);
    showToast('Failed to add website', 'error');
  }
}

/**
 * Remove a blocked site
 * @async
 * @param {string} site - Site to remove
 */
async function removeSite(site) {
  try {
    const success = await storage.removeBlockedSite(site);
    
    if (success) {
      const sites = await storage.getBlockedSites();
      renderSites(sites);
      showToast('Website removed', 'success');
      
      // Notify background to refresh rules
      await chrome.runtime.sendMessage({ action: 'refreshRules' });
    } else {
      showToast('Failed to remove website', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Popup: Remove site error:', error);
    showToast('Failed to remove website', 'error');
  }
}

/**
 * Render the sites list
 * @param {string[]} sites - Array of blocked sites
 */
function renderSites(sites) {
  const listEl = document.getElementById('sitesList');
  const emptyEl = document.getElementById('sitesEmptyState');
  
  if (!sites || sites.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  
  emptyEl.style.display = 'none';
  
  listEl.innerHTML = sites.map(site => `
    <div class="site-item">
      <div class="site-info">
        <div class="site-favicon">${site.charAt(0).toUpperCase()}</div>
        <span class="site-url">${escapeHtml(site)}</span>
      </div>
      <button class="btn btn-icon" data-site="${escapeHtml(site)}" title="Remove">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  // Add remove listeners
  listEl.querySelectorAll('.btn-icon').forEach(btn => {
    btn.addEventListener('click', () => removeSite(btn.dataset.site));
  });
}

/**
 * Toggle day button selection
 * @param {HTMLElement} btn - Day button element
 */
function toggleDaySelection(btn) {
  btn.classList.toggle('selected');
}

/**
 * Add a new schedule
 * @async
 */
async function addSchedule() {
  try {
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    
    const selectedDays = Array.from(document.querySelectorAll('.day-btn.selected'))
      .map(btn => parseInt(btn.dataset.day));
    
    if (selectedDays.length === 0) {
      showToast('Please select at least one day', 'error');
      return;
    }
    
    const schedule = {
      startTime,
      endTime,
      days: selectedDays
    };
    
    if (!utils.isValidSchedule(schedule)) {
      showToast('Please enter valid schedule times', 'error');
      return;
    }
    
    const success = await storage.addSchedule(schedule);
    
    if (success) {
      // Reset form
      document.querySelectorAll('.day-btn').forEach(btn => {
        btn.classList.remove('selected');
      });
      
      const schedules = await storage.getSchedules();
      renderSchedules(schedules);
      showToast('Schedule added successfully', 'success');
      
      // Notify background to check schedule
      await chrome.runtime.sendMessage({ action: 'checkSchedule' });
    } else {
      showToast('Failed to add schedule', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Popup: Add schedule error:', error);
    showToast('Failed to add schedule', 'error');
  }
}

/**
 * Remove a schedule
 * @async
 * @param {string} scheduleId - ID of schedule to remove
 */
async function removeSchedule(scheduleId) {
  try {
    const success = await storage.removeSchedule(scheduleId);
    
    if (success) {
      const schedules = await storage.getSchedules();
      renderSchedules(schedules);
      showToast('Schedule removed', 'success');
      
      // Notify background to check schedule
      await chrome.runtime.sendMessage({ action: 'checkSchedule' });
    } else {
      showToast('Failed to remove schedule', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Popup: Remove schedule error:', error);
    showToast('Failed to remove schedule', 'error');
  }
}

/**
 * Render the schedules list
 * @param {Array} schedules - Array of schedule objects
 */
function renderSchedules(schedules) {
  const listEl = document.getElementById('schedulesList');
  const emptyEl = document.getElementById('schedulesEmptyState');
  
  if (!schedules || schedules.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }
  
  emptyEl.style.display = 'none';
  
  listEl.innerHTML = schedules.map(schedule => {
    const daysText = schedule.days
      .sort((a, b) => a - b)
      .map(d => utils.DAYS_OF_WEEK[d])
      .join(', ');
    
    return `
      <div class="schedule-item">
        <div class="schedule-info">
          <div class="schedule-time">${escapeHtml(schedule.startTime)} - ${escapeHtml(schedule.endTime)}</div>
          <div class="schedule-days">${escapeHtml(daysText)}</div>
        </div>
        <button class="btn btn-icon" data-schedule-id="${escapeHtml(schedule.id)}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');
  
  // Add remove listeners
  listEl.querySelectorAll('.btn-icon').forEach(btn => {
    btn.addEventListener('click', () => removeSchedule(btn.dataset.scheduleId));
  });
}

/**
 * Render statistics
 * @param {Object} legacyStats - Legacy statistics object
 */
function renderStats(legacyStats) {
  document.getElementById('sitesBlockedCount').textContent = legacyStats.sitesBlocked || 0;
  document.getElementById('timeSavedValue').textContent = 
    utils.formatDuration(legacyStats.timeSaved || 0);
}

/**
 * Render weekly analytics with bar chart
 * @async
 */
async function renderWeeklyAnalytics() {
  try {
    if (!stats) return;
    
    // Validate and repair stats data
    await stats.validateAndRepairStats();
    
    // Get weekly stats
    const weeklyStats = await stats.getWeeklyStats();
    
    // Update summary
    document.getElementById('weeklyBlockedCount').textContent = weeklyStats.totalBlocked;
    document.getElementById('weeklyTimeSaved').textContent = 
      stats.formatDuration(weeklyStats.totalTimeSaved);
    
    // Render bar chart
    renderBarChart(weeklyStats.days);
    
  } catch (error) {
    console.error('FocusGuard Popup: Render weekly analytics error:', error);
  }
}

/**
 * Render the weekly bar chart
 * @param {Array} daysData - Array of daily stats
 */
function renderBarChart(daysData) {
  const chartContainer = document.getElementById('weeklyChart');
  const labelsContainer = document.getElementById('chartLabels');
  
  if (!daysData || daysData.length === 0) {
    chartContainer.innerHTML = '';
    labelsContainer.innerHTML = '';
    return;
  }
  
  // Get max value for scaling (minimum 1 to avoid division by zero)
  const maxBlocked = Math.max(...daysData.map(d => d.blockedCount), 1);
  
  // Get today's date key for highlighting
  const todayKey = stats.getTodayKey();
  
  // Generate bars
  chartContainer.innerHTML = daysData.map((day, index) => {
    const isToday = day.dateKey === todayKey;
    const heightPercent = (day.blockedCount / maxBlocked) * 100;
    const displayHeight = Math.max(heightPercent, day.blockedCount > 0 ? 8 : 4);
    const isZero = day.blockedCount === 0;
    
    return `
      <div class="chart-bar-wrapper">
        <div class="chart-bar ${isToday ? 'today' : ''} ${isZero ? 'zero' : ''}" 
             style="height: ${displayHeight}%">
          <span class="chart-bar-value">${day.blockedCount}</span>
        </div>
      </div>
    `;
  }).join('');
  
  // Generate labels
  labelsContainer.innerHTML = daysData.map((day, index) => {
    const isToday = day.dateKey === todayKey;
    // Show day abbreviation (Mon, Tue, etc.)
    const label = day.shortDay;
    
    return `
      <div class="chart-label ${isToday ? 'today' : ''}">${escapeHtml(label)}</div>
    `;
  }).join('');
}

/**
 * Update status card
 * @async
 */
async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    
    if (!response.success) {
      return;
    }
    
    const status = response.data;
    const card = document.getElementById('statusCard');
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    const details = document.getElementById('statusDetails');
    
    // Remove all status classes
    card.classList.remove('inactive', 'on-break');
    
    if (status.onBreak) {
      card.classList.add('on-break');
      text.textContent = 'On Break';
      details.textContent = `${status.breakTimeRemaining} minutes remaining`;
    } else if (status.isFocused) {
      text.textContent = 'Focus Mode Active';
      if (status.focusTimeRemaining) {
        details.textContent = `${utils.formatDuration(status.focusTimeRemaining)} remaining`;
      } else {
        details.textContent = 'Blocking distracting sites';
      }
    } else {
      card.classList.add('inactive');
      text.textContent = 'Focus Mode Inactive';
      
      if (status.schedulesCount === 0) {
        details.textContent = 'Add a schedule to start blocking';
      } else if (status.blockedSitesCount === 0) {
        details.textContent = 'Add websites to block';
      } else if (!status.canTakeBreak && status.breakCooldownRemaining > 0) {
        details.textContent = `Break available in ${status.breakCooldownRemaining}m`;
      } else {
        details.textContent = 'Outside scheduled focus hours';
      }
    }
    
  } catch (error) {
    console.error('FocusGuard Popup: Update status error:', error);
  }
}

/**
 * Start polling for status updates
 */
function startStatusPolling() {
  // Update immediately and then every 30 seconds
  updateStatus();
  setInterval(updateStatus, 30000);
}

/**
 * Open dashboard page
 * @param {Event} e - Click event
 */
function openDashboard(e) {
  e.preventDefault();
  
  const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
  chrome.tabs.create({ url: dashboardUrl });
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

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);

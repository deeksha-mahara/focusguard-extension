/**
 * @fileoverview Dashboard script for FocusGuard extension.
 * Handles the full-page dashboard UI and interactions.
 * @module dashboard
 */

// Import modules
let storage = null;
let utils = null;

// Current section
let currentSection = 'overview';

/**
 * Initialize dashboard
 * @async
 */
async function init() {
  try {
    // Load modules
    storage = await import(chrome.runtime.getURL('background/storage.js'));
    utils = await import(chrome.runtime.getURL('background/utils.js'));
    
    // Initialize theme
    await initTheme();
    
    // Load initial data
    await loadData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start status polling
    startStatusPolling();
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Initialization error:', error);
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
    document.getElementById('darkModeToggle').checked = theme === 'dark';
  } catch (error) {
    console.error('FocusGuard Dashboard: Theme init error:', error);
  }
}

/**
 * Load all dashboard data
 * @async
 */
async function loadData() {
  try {
    // Load stats for overview
    await loadStats();
    
    // Load sites
    const sites = await storage.getBlockedSites();
    renderSites(sites);
    
    // Load schedules
    const schedules = await storage.getSchedules();
    renderSchedules(schedules);
    
    // Load quote
    displayRandomQuote();
    
    // Update sidebar status
    await updateSidebarStatus();
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Load data error:', error);
  }
}

/**
 * Load and display statistics
 * @async
 */
async function loadStats() {
  try {
    const stats = await storage.getStats();
    const sites = await storage.getBlockedSites();
    const schedules = await storage.getSchedules();
    
    document.getElementById('totalBlocked').textContent = stats.sitesBlocked || 0;
    document.getElementById('totalTimeSaved').textContent = utils.formatDuration(stats.timeSaved || 0);
    document.getElementById('activeSchedules').textContent = schedules.length;
    document.getElementById('blockedSitesCount').textContent = sites.length;
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Load stats error:', error);
  }
}

/**
 * Display a random motivational quote
 */
function displayRandomQuote() {
  const quote = utils.getRandomQuote();
  const parts = quote.split(' - ');
  
  document.getElementById('dashboardQuote').textContent = parts[0];
  document.getElementById('dashboardQuoteAuthor').textContent = parts[1] ? `- ${parts[1]}` : '';
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      switchSection(item.dataset.section);
    });
  });
  
  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('darkModeToggle').addEventListener('change', toggleTheme);
  
  // Quick actions
  document.getElementById('quickAddSite').addEventListener('click', () => openModal('addSiteModal'));
  document.getElementById('quickAddSchedule').addEventListener('click', () => openModal('addScheduleModal'));
  document.getElementById('openPopup').addEventListener('click', openPopup);
  
  // Add site modal
  document.getElementById('addSiteBtn').addEventListener('click', () => openModal('addSiteModal'));
  document.getElementById('closeSiteModal').addEventListener('click', () => closeModal('addSiteModal'));
  document.getElementById('cancelSiteModal').addEventListener('click', () => closeModal('addSiteModal'));
  document.getElementById('confirmAddSite').addEventListener('click', addSiteFromModal);
  
  // Add schedule modal
  document.getElementById('addScheduleBtn').addEventListener('click', () => openModal('addScheduleModal'));
  document.getElementById('closeScheduleModal').addEventListener('click', () => closeModal('addScheduleModal'));
  document.getElementById('cancelScheduleModal').addEventListener('click', () => closeModal('addScheduleModal'));
  document.getElementById('confirmAddSchedule').addEventListener('click', addScheduleFromModal);
  
  // Day selection in modal
  document.querySelectorAll('#addScheduleModal .day-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleDaySelection(btn));
  });
  
  // Enter key on inputs
  document.getElementById('modalSiteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addSiteFromModal();
  });
  
  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', () => {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
      });
    });
  });
}

/**
 * Switch between sections
 * @param {string} section - Section name to switch to
 */
function switchSection(section) {
  currentSection = section;
  
  // Update navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.section === section);
  });
  
  // Update sections
  document.querySelectorAll('.section').forEach(sec => {
    sec.classList.remove('active');
  });
  document.getElementById(`${section}Section`).classList.add('active');
  
  // Update page title
  const titles = {
    overview: 'Dashboard Overview',
    sites: 'Blocked Websites',
    schedule: 'Focus Schedules',
    settings: 'Settings'
  };
  document.getElementById('pageTitle').textContent = titles[section];
}

/**
 * Toggle theme
 * @async
 */
async function toggleTheme() {
  try {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    document.getElementById('darkModeToggle').checked = newTheme === 'dark';
    
    await storage.setTheme(newTheme);
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Toggle theme error:', error);
  }
}

/**
 * Open a modal
 * @param {string} modalId - Modal element ID
 */
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
  
  // Focus first input
  const input = document.querySelector(`#${modalId} input`);
  if (input) input.focus();
}

/**
 * Close a modal
 * @param {string} modalId - Modal element ID
 */
function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  
  // Reset form
  const inputs = document.querySelectorAll(`#${modalId} input`);
  inputs.forEach(input => {
    if (input.type === 'checkbox') {
      input.checked = false;
    } else if (input.type !== 'time') {
      input.value = '';
    }
  });
  
  // Reset day buttons
  document.querySelectorAll(`#${modalId} .day-btn`).forEach(btn => {
    btn.classList.remove('selected');
  });
}

/**
 * Add site from modal
 * @async
 */
async function addSiteFromModal() {
  try {
    const input = document.getElementById('modalSiteInput');
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
      closeModal('addSiteModal');
      const sites = await storage.getBlockedSites();
      renderSites(sites);
      await loadStats();
      showToast('Website added successfully', 'success');
      
      // Notify background
      await chrome.runtime.sendMessage({ action: 'refreshRules' });
    } else {
      showToast('Failed to add website', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Add site error:', error);
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
      await loadStats();
      showToast('Website removed', 'success');
      
      // Notify background
      await chrome.runtime.sendMessage({ action: 'refreshRules' });
    } else {
      showToast('Failed to remove website', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Remove site error:', error);
    showToast('Failed to remove website', 'error');
  }
}

/**
 * Render sites table
 * @param {string[]} sites - Array of blocked sites
 */
function renderSites(sites) {
  const tableBody = document.getElementById('sitesTableBody');
  const emptyState = document.getElementById('sitesEmptyState');
  const table = document.getElementById('sitesTable');
  
  if (!sites || sites.length === 0) {
    table.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  table.style.display = 'table';
  emptyState.style.display = 'none';
  
  tableBody.innerHTML = sites.map(site => `
    <tr>
      <td>
        <div class="site-cell">
          <div class="site-favicon">${site.charAt(0).toUpperCase()}</div>
          <span>${escapeHtml(site)}</span>
        </div>
      </td>
      <td>--</td>
      <td>
        <button class="btn btn-danger" data-site="${escapeHtml(site)}">
          Remove
        </button>
      </td>
    </tr>
  `).join('');
  
  // Add remove listeners
  tableBody.querySelectorAll('.btn-danger').forEach(btn => {
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
 * Add schedule from modal
 * @async
 */
async function addScheduleFromModal() {
  try {
    const startTime = document.getElementById('modalStartTime').value;
    const endTime = document.getElementById('modalEndTime').value;
    
    const selectedDays = Array.from(document.querySelectorAll('#addScheduleModal .day-btn.selected'))
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
      closeModal('addScheduleModal');
      const schedules = await storage.getSchedules();
      renderSchedules(schedules);
      await loadStats();
      showToast('Schedule added successfully', 'success');
      
      // Notify background
      await chrome.runtime.sendMessage({ action: 'checkSchedule' });
    } else {
      showToast('Failed to add schedule', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Add schedule error:', error);
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
      await loadStats();
      showToast('Schedule removed', 'success');
      
      // Notify background
      await chrome.runtime.sendMessage({ action: 'checkSchedule' });
    } else {
      showToast('Failed to remove schedule', 'error');
    }
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Remove schedule error:', error);
    showToast('Failed to remove schedule', 'error');
  }
}

/**
 * Render schedules list
 * @param {Array} schedules - Array of schedule objects
 */
function renderSchedules(schedules) {
  const listEl = document.getElementById('dashboardSchedulesList');
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
          <h4>${escapeHtml(schedule.startTime)} - ${escapeHtml(schedule.endTime)}</h4>
          <p>${escapeHtml(daysText)}</p>
        </div>
        <button class="btn btn-danger" data-schedule-id="${escapeHtml(schedule.id)}">
          Remove
        </button>
      </div>
    `;
  }).join('');
  
  // Add remove listeners
  listEl.querySelectorAll('.btn-danger').forEach(btn => {
    btn.addEventListener('click', () => removeSchedule(btn.dataset.scheduleId));
  });
}

/**
 * Open extension popup
 */
function openPopup() {
  chrome.action.openPopup();
}

/**
 * Update sidebar status
 * @async
 */
async function updateSidebarStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
    
    if (!response.success) return;
    
    const status = response.data;
    const statusCard = document.getElementById('sidebarStatus');
    const statusText = statusCard.querySelector('.status-text');
    
    statusCard.classList.remove('inactive', 'on-break');
    
    if (status.onBreak) {
      statusCard.classList.add('on-break');
      statusText.textContent = 'On Break';
    } else if (status.isFocused) {
      statusText.textContent = 'Focus Mode Active';
    } else {
      statusCard.classList.add('inactive');
      statusText.textContent = 'Focus Mode Inactive';
    }
    
  } catch (error) {
    console.error('FocusGuard Dashboard: Update status error:', error);
  }
}

/**
 * Start status polling
 */
function startStatusPolling() {
  updateSidebarStatus();
  setInterval(updateSidebarStatus, 30000);
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

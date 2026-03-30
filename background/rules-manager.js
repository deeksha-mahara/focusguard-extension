/**
 * @fileoverview Rules Manager for FocusGuard extension.
 * Handles dynamic rule creation and management using Chrome Declarative Net Request API.
 * @module rules-manager
 */

import { getBlockedSites, incrementBlockedCount } from './storage.js';

/**
 * Rule ID offset for FocusGuard rules (to avoid conflicts)
 * @constant {number}
 */
const RULE_ID_OFFSET = 1000;

/**
 * Maximum number of dynamic rules allowed
 * @constant {number}
 */
const MAX_DYNAMIC_RULES = 5000;

/**
 * Applies blocking rules for the given sites
 * @async
 * @param {string[]} sites - Array of site URLs to block
 * @returns {Promise<boolean>} True if rules applied successfully
 */
async function applyBlockingRules(sites) {
  try {
    // First, remove all existing FocusGuard rules
    await removeAllFocusGuardRules();
    
    if (!sites || sites.length === 0) {
      return true;
    }
    
    // Create new rules for each site
    const rules = sites.map((site, index) => createBlockingRule(site, index));
    
    // Add rules in batches to avoid API limits
    const batchSize = 100;
    for (let i = 0; i < rules.length; i += batchSize) {
      const batch = rules.slice(i, i + batchSize);
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: batch
      });
    }
    
    console.log(`FocusGuard: Applied ${rules.length} blocking rules`);
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to apply blocking rules:', error);
    return false;
  }
}

/**
 * Removes all FocusGuard blocking rules
 * @async
 * @returns {Promise<boolean>} True if rules removed successfully
 */
async function removeAllFocusGuardRules() {
  try {
    // Get all existing dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    
    // Filter for FocusGuard rules (those with ID >= RULE_ID_OFFSET)
    const focusGuardRuleIds = existingRules
      .filter(rule => rule.id >= RULE_ID_OFFSET)
      .map(rule => rule.id);
    
    if (focusGuardRuleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: focusGuardRuleIds
      });
      console.log(`FocusGuard: Removed ${focusGuardRuleIds.length} blocking rules`);
    }
    
    return true;
  } catch (error) {
    console.error('FocusGuard: Failed to remove blocking rules:', error);
    return false;
  }
}

/**
 * Creates a blocking rule for a specific site
 * @param {string} site - Site URL to block
 * @param {number} index - Rule index for ID generation
 * @returns {Object} Chrome declarativeNetRequest rule object
 */
function createBlockingRule(site, index) {
  const ruleId = RULE_ID_OFFSET + index;
  
  // Normalize site - remove protocol and www if present
  let normalizedSite = site.toLowerCase().trim();
  normalizedSite = normalizedSite.replace(/^https?:\/\//, '');
  normalizedSite = normalizedSite.replace(/^www\./, '');
  normalizedSite = normalizedSite.split('/')[0]; // Remove path
  
  // Create URL filter that matches domain and all subdomains
  // This will match: example.com, www.example.com, sub.example.com, etc.
  const urlFilter = `*://*.${normalizedSite}/*`;
  
  return {
    id: ruleId,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        extensionPath: '/blocked/blocked.html'
      }
    },
    condition: {
      urlFilter: urlFilter,
      resourceTypes: ['main_frame']
    }
  };
}

/**
 * Refreshes blocking rules based on current blocked sites
 * @async
 * @returns {Promise<boolean>} True if refresh successful
 */
async function refreshBlockingRules() {
  try {
    const sites = await getBlockedSites();
    return await applyBlockingRules(sites);
  } catch (error) {
    console.error('FocusGuard: Failed to refresh blocking rules:', error);
    return false;
  }
}

/**
 * Checks if blocking rules are currently active
 * @async
 * @returns {Promise<boolean>} True if rules are active
 */
async function areRulesActive() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    return rules.some(rule => rule.id >= RULE_ID_OFFSET);
  } catch (error) {
    console.error('FocusGuard: Failed to check rules status:', error);
    return false;
  }
}

/**
 * Gets the count of active blocking rules
 * @async
 * @returns {Promise<number>} Number of active rules
 */
async function getActiveRulesCount() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    return rules.filter(rule => rule.id >= RULE_ID_OFFSET).length;
  } catch (error) {
    console.error('FocusGuard: Failed to get rules count:', error);
    return 0;
  }
}

/**
 * Handles a blocked site visit by incrementing counter
 * Called when the blocked page loads
 * @async
 * @returns {Promise<boolean>} True if tracked successfully
 */
async function trackBlockedVisit() {
  return await incrementBlockedCount();
}

// Export for use in other modules
export {
  applyBlockingRules,
  removeAllFocusGuardRules,
  refreshBlockingRules,
  areRulesActive,
  getActiveRulesCount,
  trackBlockedVisit,
  RULE_ID_OFFSET,
  MAX_DYNAMIC_RULES
};

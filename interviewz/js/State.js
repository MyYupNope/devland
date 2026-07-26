/**
 * Global state management for OpportunityTracker
 */

export const state = {
  rawApplications: [],
  activeApplications: [],
  filteredApplications: [],
  selectedCompany: null,
  selectedJobTitle: null,
  selectedStatus: null,
  currentApp: null,
  currentSortVal: 'date-desc',
  dataVersion: 0,
  dashboardRange: localStorage.getItem('dashboardRange') || 'yearly'
};

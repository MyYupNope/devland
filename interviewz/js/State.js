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
  currentPage: 1,
  rowsPerPage: 5,
  currentApp: null,
  currentSortVal: 'date-desc',
  dataVersion: 0
};

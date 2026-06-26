import { FacetedSelect } from './FacetedSelect.js';
import { FormApp } from './FormApp.js';
import { state } from './State.js';
import { renderAllDashboardWidgets } from './Charts.js';
import { parseMarkdown } from './Markdown.js';
import { showToast } from './Toast.js';
import {
  escapeHtml,
  parseDate,
  formatDisplayDate,
  postForm,
  getLastComment,
  parseCommentLine
} from './Utils.js';
import {
  SHEET_EXPORT_URL,
  NOTES_API_ENDPOINT,
  CSV_CACHE_KEY
} from './Config.js';

// DOM Element Cache
const dom = {};

function initDomCache() {
  dom.syncStatus = document.getElementById('syncStatus');
  dom.statTotal = document.getElementById('statTotal');
  dom.statActivePipeline = document.getElementById('statActivePipeline');
  dom.statCompanies = document.getElementById('statCompanies');
  dom.statJobs = document.getElementById('statJobs');
  dom.statActiveApps = document.getElementById('statActiveApps');
  dom.statConversion = document.getElementById('statConversion');
  dom.statRejectionRate = document.getElementById('statRejectionRate');
  dom.statAvgSuitability = document.getElementById('statAvgSuitability');
  dom.statThisWeek = document.getElementById('statThisWeek');
  dom.statThisMonth = document.getElementById('statThisMonth');

  dom.btnResetFilters = document.getElementById('btnResetFilters');
  dom.registryTableBody = document.getElementById('registryTableBody');
  dom.noResults = document.getElementById('noResults');
  dom.resultsCount = document.getElementById('resultsCount');
  dom.activeInterviewsCount = document.getElementById('activeInterviewsCount');
  dom.registryTableContainer = document.querySelector('.registry-table-container');

  dom.companySelectContainer = document.getElementById('companySelectContainer');
  dom.companyTrigger = document.getElementById('companyTrigger');
  dom.companySearch = document.getElementById('companySearch');
  dom.companyOptions = document.getElementById('companyOptions');

  dom.jobSelectContainer = document.getElementById('jobSelectContainer');
  dom.jobTrigger = document.getElementById('jobTrigger');
  dom.jobSearch = document.getElementById('jobSearch');
  dom.jobOptions = document.getElementById('jobOptions');

  dom.statusSelectContainer = document.getElementById('statusSelectContainer');
  dom.statusTrigger = document.getElementById('statusTrigger');
  dom.statusSearch = document.getElementById('statusSearch');
  dom.statusOptions = document.getElementById('statusOptions');

  dom.drawerOverlay = document.getElementById('drawerOverlay');
  dom.detailsDrawer = document.getElementById('detailsDrawer');
  dom.btnCloseDrawer = document.getElementById('btnCloseDrawer');
  dom.drawerStatusBadge = document.getElementById('drawerStatusBadge');
  dom.drawerJobTitleDisplay = document.getElementById('drawerJobTitleDisplay');
  dom.drawerCompanyNameDisplay = document.getElementById('drawerCompanyNameDisplay');
  dom.drawerJobTitle = document.getElementById('drawerJobTitle');
  dom.drawerCompanyName = document.getElementById('drawerCompanyName');
  dom.drawerDate = document.getElementById('drawerDate');
  dom.drawerHiringTeam = document.getElementById('drawerHiringTeam');
  dom.drawerFollowUp = document.getElementById('drawerFollowUp');
  dom.drawerSuitabilityScoreContainer = document.getElementById('drawerSuitabilityScoreContainer');
  dom.drawerSuitabilityScore = document.getElementById('drawerSuitabilityScore');
  dom.drawerSuitabilityEval = document.getElementById('drawerSuitabilityEval');
  dom.sectionSuitabilityEval = document.getElementById('sectionSuitabilityEval');
  dom.drawerComments = document.getElementById('drawerComments');
  dom.sectionComments = document.getElementById('sectionComments');
  dom.drawerJobDescription = document.getElementById('drawerJobDescription');
  dom.drawerCompanyDescription = document.getElementById('drawerCompanyDescription');
  dom.linkJobUrl = document.getElementById('linkJobUrl');
  dom.linkJobUrlAnchor = document.getElementById('linkJobUrlAnchor');
  dom.linkCompanyFolder = document.getElementById('linkCompanyFolder');
  dom.drawerInterviewCompany = document.getElementById('drawerInterviewCompany');
  dom.drawerInterviewPreparation = document.getElementById('drawerInterviewPreparation');

  dom.activeInterviewsSection = document.getElementById('activeInterviewsSection');
  dom.activeInterviewsGrid = document.getElementById('activeInterviewsGrid');
  dom.filtersSection = document.querySelector('.filters-section');
  dom.resultsSection = document.querySelector('.results-section');
  dom.statsSection = document.querySelector('.stats-section');
  dom.analyticsSection = document.querySelector('.analytics-section');
  dom.newApplicationSection = document.querySelector('.new-application-section');
  dom.resumeSection = document.querySelector('.resume-section');
  dom.fabBtn = document.getElementById('fabNewApplication');
  dom.refreshBtn = document.getElementById('btnHeaderRefresh');
  dom.syncContainer = document.querySelector('.sync-container');
  dom.heroBanner = document.querySelector('.hero-banner');
  dom.topbarBrandLink = document.getElementById('topbarBrandLink');
  dom.landingTabContent = document.getElementById('landingTabContent');

  dom.paginationInfo = document.getElementById('paginationInfo');
  dom.btnPrevPage = document.getElementById('btnPrevPage');
  dom.btnNextPage = document.getElementById('btnNextPage');
  dom.rowsPerPageSelect = document.getElementById('rowsPerPageSelect');
}

// Global drop-down components
let companySelect, jobSelect, statusSelect;

function initializeApp() {
  initDomCache();

  companySelect = new FacetedSelect(dom.companySelectContainer, dom.companyTrigger, dom.companySearch, dom.companyOptions, 'All Companies');
  jobSelect = new FacetedSelect(dom.jobSelectContainer, dom.jobTrigger, dom.jobSearch, dom.jobOptions, 'All Job Titles');
  statusSelect = new FacetedSelect(dom.statusSelectContainer, dom.statusTrigger, dom.statusSearch, dom.statusOptions, 'All Statuses');

  setupEventListeners();
  fetchData();
  initTabNavigation();
  initScrollReveal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

/**
 * Helper to copy HTML of a target element as rich text.
 */
function copyElementHtml(button, targetElement) {
  if (!targetElement) return;
  const html = targetElement.innerHTML;
  const plainText = targetElement.innerText || targetElement.textContent || '';
  
  const htmlBlob = new Blob([html], { type: 'text/html' });
  const textBlob = new Blob([plainText], { type: 'text/plain' });
  
  const clipboardItem = new ClipboardItem({
    'text/html': htmlBlob,
    'text/plain': textBlob
  });
  
  navigator.clipboard.write([clipboardItem]).then(() => {
    // Show success feedback
    const iconCopy = button.querySelector('.icon-copy');
    const iconCheck = button.querySelector('.icon-check');
    if (iconCopy && iconCheck) {
      iconCopy.style.display = 'none';
      iconCheck.style.display = '';
      setTimeout(() => {
        iconCopy.style.display = '';
        iconCheck.style.display = 'none';
      }, 2000);
    }
    showToast('Notes copied to clipboard as Rich Text.', 'success');
  }).catch(err => {
    console.error('Failed to copy html: ', err);
    showToast('Failed to copy text. Please try manually selecting and copying.', 'error');
  });
}

function setupEventListeners() {
  // Global click listener to close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (dom.companySelectContainer && !dom.companySelectContainer.contains(e.target)) {
      companySelect.close();
    }
    if (dom.jobSelectContainer && !dom.jobSelectContainer.contains(e.target)) {
      jobSelect.close();
    }
    if (dom.statusSelectContainer && !dom.statusSelectContainer.contains(e.target)) {
      statusSelect.close();
    }
  });

  // Topbar Brand click listener (replaced inline onclick)
  if (dom.topbarBrandLink) {
    dom.topbarBrandLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.switchTab('landing');
    });
  }

  // Theme Toggle Button
  const btnThemeToggle = document.getElementById('themeToggleBtn');

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.classList.contains('theme-dark');
      if (isDark) {
        document.documentElement.classList.remove('theme-dark');
        document.documentElement.classList.add('theme-light');
        localStorage.setItem('theme', 'light');
      } else {
        document.documentElement.classList.remove('theme-light');
        document.documentElement.classList.add('theme-dark');
        localStorage.setItem('theme', 'dark');
      }
    });
  }


  // Refresh Button
  const btnHeaderRefresh = document.getElementById('btnHeaderRefresh');
  if (btnHeaderRefresh) {
    btnHeaderRefresh.addEventListener('click', () => {
      fetchData();
    });
  }

  if (dom.btnResetFilters) {
    dom.btnResetFilters.addEventListener('click', () => {
      state.selectedCompany = null;
      state.selectedJobTitle = null;
      state.selectedStatus = null;
      
      updateFiltersUI();
      applyFilters(true);
    });
  }

  // Reset Button Interview Notes
  const btnResetInterviewNotes = document.getElementById('btnResetInterviewNotes');
  if (btnResetInterviewNotes) {
    btnResetInterviewNotes.addEventListener('click', () => {
      const inp = document.getElementById('inputInterviewNotes');
      if (inp) {
        inp.value = '';
        showToast('Interview notes reset', 'info');
      }
    });
  }

  // Submit notes event listener
  const formJobInterview = document.getElementById('jobinterview');
  if (formJobInterview) {
    formJobInterview.addEventListener('submit', (e) => {
      e.preventDefault();

      const notesEl = document.getElementById('inputInterviewNotes');

      const submitter = e.submitter;
      if (submitter) {
        if (submitter.id === 'btnSubmitInterviewNotes') {
          if (!notesEl || notesEl.value.trim() === '') {
            showToast('Please enter some notes before submitting', 'warning');
            return;
          }
        }
      } else {
        const notesVal = notesEl ? notesEl.value.trim() : '';
        if (notesVal === '') {
          showToast('Please enter some notes before submitting', 'warning');
          return;
        }
      }

      submitJobInterviewForm();
    });
  }

  // Drawer Close Actions
  if (dom.btnCloseDrawer) dom.btnCloseDrawer.addEventListener('click', closeDetailsDrawer);
  if (dom.drawerOverlay) dom.drawerOverlay.addEventListener('click', closeDetailsDrawer);
  
  // Drawer Tab Click Event Listeners
  if (dom.detailsDrawer) {
    const drawerTabs = dom.detailsDrawer.querySelectorAll('.drawer-tab');
    drawerTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (!tab.classList.contains('disabled')) {
          selectTab(tab.id);
        }
      });
    });
  }

  // Drawer Tabs Keyboard Navigation (Arrow keys Left/Right)
  const drawerTabsContainer = dom.detailsDrawer ? dom.detailsDrawer.querySelector('.drawer-tabs') : null;
  if (drawerTabsContainer) {
    drawerTabsContainer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const tabs = Array.from(drawerTabsContainer.querySelectorAll('.drawer-tab'));
        const enabledTabs = tabs.filter(t => !t.classList.contains('disabled'));
        const activeIndex = enabledTabs.findIndex(t => t.classList.contains('active'));
        
        let nextIndex = activeIndex;
        if (e.key === 'ArrowRight') {
          nextIndex = (activeIndex + 1) % enabledTabs.length;
        } else if (e.key === 'ArrowLeft') {
          nextIndex = (activeIndex - 1 + enabledTabs.length) % enabledTabs.length;
        }
        
        const nextTab = enabledTabs[nextIndex];
        if (nextTab) {
          selectTab(nextTab.id);
          nextTab.focus();
        }
      }
    });
  }

  // ESC Key to close dropdowns and drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      companySelect.close();
      jobSelect.close();
      statusSelect.close();
      closeDetailsDrawer();
    }
  });

  // Table sorting from header clicks
  document.querySelectorAll('.sortable-header').forEach(header => {
    header.addEventListener('click', () => {
      const field = header.getAttribute('data-sort-field');
      const currentVal = state.currentSortVal;
      const [currentField, currentDir] = currentVal.split('-');
      
      let newDir = 'asc';
      if (field === currentField) {
        newDir = currentDir === 'asc' ? 'desc' : 'asc';
      } else {
        newDir = field === 'date' ? 'desc' : 'asc';
      }
      
      state.currentSortVal = `${field}-${newDir}`;
      applyFilters(true);
    });
  });

  // Event Delegation: Registry Table Row Clicks
  if (dom.registryTableBody) {
    dom.registryTableBody.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (row) {
        // Prevent trigger if clicking details button directly (though both open drawer)
        const index = parseInt(row.getAttribute('data-index'), 10);
        const app = state.filteredApplications[index];
        if (app) openDetailsDrawer(app);
      }
    });
  }

  // Event Delegation: Active Interviews Pipeline Card Click
  if (dom.activeInterviewsGrid) {
    dom.activeInterviewsGrid.addEventListener('click', (e) => {
      const trigger = e.target.closest('.view-detail-trigger');
      if (trigger) {
        e.stopPropagation();
        const card = trigger.closest('.interview-card');
        const company = card.getAttribute('data-company');
        const title = card.getAttribute('data-title');
        
        const app = state.rawApplications.find(a => 
          (a['Company Name'] || '').trim() === company && 
          (a['Job Title'] || '').trim() === title
        );
        if (app) openDetailsDrawer(app);
      }
    });
  }

  // Paging controls
  if (dom.btnPrevPage) {
    dom.btnPrevPage.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTable();
      }
    });
  }
  if (dom.btnNextPage) {
    dom.btnNextPage.addEventListener('click', () => {
      const maxPage = Math.ceil(state.filteredApplications.length / state.rowsPerPage);
      if (state.currentPage < maxPage) {
        state.currentPage++;
        renderTable();
      }
    });
  }

  // Rows per page dropdown listener
  if (dom.rowsPerPageSelect) {
    dom.rowsPerPageSelect.addEventListener('change', (e) => {
      state.rowsPerPage = parseInt(e.target.value, 10) || 5;
      state.currentPage = 1;
      renderTable();
    });
  }

  // Copy HTML buttons in Job Interview accordion
  const btnCopyCompany = document.getElementById('btnCopyInterviewCompany');
  if (btnCopyCompany) {
    btnCopyCompany.addEventListener('click', () => {
      const target = document.getElementById('drawerInterviewCompany');
      copyElementHtml(btnCopyCompany, target);
    });
  }

  const btnCopyPrep = document.getElementById('btnCopyInterviewPreparation');
  if (btnCopyPrep) {
    btnCopyPrep.addEventListener('click', () => {
      const target = document.getElementById('drawerInterviewPreparation');
      copyElementHtml(btnCopyPrep, target);
    });
  }
}

/**
 * Fetch and Parse Data with offline Local Storage support
 */
function fetchData() {
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const cachedVal = localStorage.getItem(CACHE_KEY_CSV());
  let cachedCsvText = null;
  let hasLoadedFromCache = false;

  if (cachedVal) {
    try {
      const cachedObj = JSON.parse(cachedVal);
      if (cachedObj && typeof cachedObj === 'object' && cachedObj.csv && cachedObj.timestamp) {
        if (Date.now() - cachedObj.timestamp < CACHE_TTL_MS) {
          cachedCsvText = cachedObj.csv;
        } else {
          console.log('[OpportunityTracker] Cache expired');
        }
      }
    } catch (e) {
      cachedCsvText = cachedVal;
    }
  }

  if (cachedCsvText) {
    try {
      setSyncState('loading', 'Syncing...');
      parseAndInitializeData(cachedCsvText);
      hasLoadedFromCache = true;
    } catch (e) {
      console.error('[OpportunityTracker] Failed parsing cached CSV:', e);
      localStorage.removeItem(CACHE_KEY_CSV());
    }
  }

  if (!hasLoadedFromCache) {
    setSyncState('loading', 'Loading Registry...');
    dom.noResults.classList.add('hidden');
    if (dom.registryTableContainer) dom.registryTableContainer.style.display = 'none';
  }

  fetch(SHEET_EXPORT_URL)
    .then(response => {
      if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
      return response.text();
    })
    .then(csvText => {
      if (!csvText || csvText.trim() === '') throw new Error('Received empty CSV data.');
      
      const newCache = { csv: csvText, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY_CSV(), JSON.stringify(newCache));

      parseAndInitializeData(csvText);
      
      const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      setSyncState('success', `Synced ${lastUpdated}`);
    })
    .catch(error => {
      console.error('[OpportunityTracker] Fetch error:', error);
      if (hasLoadedFromCache) {
        const cachedObj = JSON.parse(localStorage.getItem(CACHE_KEY_CSV()) || '{}');
        const syncTime = cachedObj.timestamp
          ? new Date(cachedObj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
          : 'Cached';
        setSyncState('success', `Offline (${syncTime})`);
      } else {
        setSyncState('error', 'Sync Failed');
        dom.noResults.classList.remove('hidden');
        dom.noResults.innerHTML = `
          <div class="no-results-card">
            <svg class="no-results-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h4>Network Error</h4>
            <p>Could not connect to the database. Check your internet connection and try again.</p>
            <button class="btn-reset" onclick="location.reload()" style="margin-top: 1rem;">Retry Connection</button>
          </div>
        `;
      }
    });
}

function CACHE_KEY_CSV() {
  return CSV_CACHE_KEY;
}

function setSyncState(status, message) {
  if (!dom.syncStatus) return;
  dom.syncStatus.className = `sync-status ${status}`;
  dom.syncStatus.innerHTML = `
    <span class="status-dot"></span>
    <span class="status-text">${message}</span>
  `;
}

/**
 * State-Machine CSV Parser
 */
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentFieldChars = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const nextC = text[i + 1];

    if (c === '"') {
      if (inQuotes && nextC === '"') {
        currentFieldChars.push('"');
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      currentRow.push(currentFieldChars.join(''));
      currentFieldChars = [];
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      currentRow.push(currentFieldChars.join(''));
      currentFieldChars = [];
      if (c === '\r' && nextC === '\n') {
        i++;
      }
      rows.push(currentRow);
      currentRow = [];
    } else {
      currentFieldChars.push(c);
    }
  }

  if (currentFieldChars.length > 0 || currentRow.length > 0) {
    currentRow.push(currentFieldChars.join(''));
    rows.push(currentRow);
  }

  return rows;
}

/**
 * Map CSV rows into JSON objects and set initial state
 */
function parseAndInitializeData(csvText) {
  const parsedRows = parseCSV(csvText);
  if (parsedRows.length < 2) return;

  const headers = parsedRows[0].map(h => h.trim());
  state.rawApplications = [];

  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.length === 0 || (row.length === 1 && row[0] === '')) continue;

    const app = {};
    headers.forEach((header, index) => {
      app[header] = row[index] !== undefined ? row[index] : '';
    });
    state.rawApplications.push(app);
  }

  // Normalize column name aliases once at load time
  state.rawApplications.forEach(app => {
    if (!app['Job_Suitability'] && app['Job Suitability']) {
      app['Job_Suitability'] = app['Job Suitability'];
    }
    if (!app['Job_Suitability_Evaluation'] && app['Job Suitability Evaluation']) {
      app['Job_Suitability_Evaluation'] = app['Job Suitability Evaluation'];
    }
  });

  state.activeApplications = state.rawApplications.filter(app => {
    const status = (app['Application Status'] || '').trim().toLowerCase();
    return status !== 'retired' && status !== 'rejected';
  });

  updateFiltersUI();
  applyFilters(true);
  calculateStatistics();

  // Render all dashboard widgets
  renderAllDashboardWidgets(state.rawApplications);
}

/**
 * Optimized dashboard statistics calculation in a single-pass loop.
 */
function calculateStatistics() {
  if (dom.statTotal) dom.statTotal.textContent = state.rawApplications.length;
  if (dom.statActivePipeline) dom.statActivePipeline.textContent = state.activeApplications.length;

  const uniqueCompanies = new Set();
  const uniqueJobs = new Set();
  let activeAppsCount = 0;
  let interviewCount = 0;
  let conversionCount = 0;
  let rejectedCount = 0;
  let totalSuitability = 0;
  let suitabilityCount = 0;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentDay = today.getDay();
  const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - distanceToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  let appsThisWeek = 0;
  let appsThisMonth = 0;

  state.rawApplications.forEach(app => {
    const company = (app['Company Name'] || '').trim();
    if (company) uniqueCompanies.add(company);

    const job = (app['Job Title'] || '').trim();
    if (job) uniqueJobs.add(job);

    const status = (app['Application Status'] || '').trim().toLowerCase();
    const isActive = status !== '' && status !== 'ready' && status !== 'applied' && status !== 'rejected' && status !== 'withdraw' && status !== 'withdrawn';
    if (isActive) {
      activeAppsCount++;
    }

    if (status.includes('interview')) {
      interviewCount++;
      conversionCount++;
    } else if (status === 'offer' || status === 'ready' || status === 'accepted') {
      conversionCount++;
    } else if (status === 'rejected') {
      rejectedCount++;
    }

    const suitabilityVal = (app['Job_Suitability'] || '').trim();
    const score = parseFloat(suitabilityVal);
    if (!isNaN(score)) {
      totalSuitability += score;
      suitabilityCount++;
    }

    const dateStr = (app['Create Date'] || '').trim();
    if (dateStr) {
      const appDate = parseDate(dateStr);
      appDate.setHours(0, 0, 0, 0);
      if (appDate >= startOfWeek) {
        appsThisWeek++;
      }
      if (appDate >= startOfMonth) {
        appsThisMonth++;
      }
    }
  });

  if (dom.statCompanies) dom.statCompanies.textContent = uniqueCompanies.size;
  if (dom.statJobs) dom.statJobs.textContent = uniqueJobs.size;
  if (dom.statActiveApps) dom.statActiveApps.textContent = activeAppsCount;

  const conversionRate = state.rawApplications.length > 0
    ? Math.round((conversionCount / state.rawApplications.length) * 100)
    : 0;
  if (dom.statConversion) dom.statConversion.textContent = `${conversionRate}%`;

  const rejectionRate = state.rawApplications.length > 0
    ? Math.round((rejectedCount / state.rawApplications.length) * 100)
    : 0;
  if (dom.statRejectionRate) dom.statRejectionRate.textContent = `${rejectionRate}%`;

  const avgSuitability = suitabilityCount > 0 ? (totalSuitability / suitabilityCount).toFixed(1) : '0.0';
  if (dom.statAvgSuitability) dom.statAvgSuitability.textContent = `${avgSuitability}/5`;

  if (dom.statThisWeek) dom.statThisWeek.textContent = appsThisWeek;
  if (dom.statThisMonth) dom.statThisMonth.textContent = appsThisMonth;
}

function updateFiltersUI() {
  const companyPool = state.activeApplications.filter(app => {
    const matchJob = !state.selectedJobTitle || (app['Job Title'] || '').trim() === state.selectedJobTitle;
    const matchStatus = !state.selectedStatus || (app['Application Status'] || '').trim() === state.selectedStatus;
    return matchJob && matchStatus;
  });

  const distinctCompanies = [...new Set(
    companyPool.map(app => (app['Company Name'] || '').trim()).filter(name => name !== '')
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  companySelect.populate(distinctCompanies, state.selectedCompany, (company) => {
    state.selectedCompany = company;
    
    if (state.selectedCompany) {
      const companyApps = state.activeApplications.filter(app => 
        (app['Company Name'] || '').trim() === state.selectedCompany
      );
      const companyJobs = [...new Set(
        companyApps.map(app => (app['Job Title'] || '').trim()).filter(title => title !== '')
      )];
      
      if (companyJobs.length === 1) {
        state.selectedJobTitle = companyJobs[0];
      } else {
        if (state.selectedJobTitle) {
          const isValid = companyJobs.includes(state.selectedJobTitle);
          if (!isValid) {
            state.selectedJobTitle = null;
          }
        }
      }
    } else {
      if (state.selectedJobTitle) {
        const isValid = state.activeApplications.some(app => 
          (app['Job Title'] || '').trim() === state.selectedJobTitle
        );
        if (!isValid) {
          state.selectedJobTitle = null;
        }
      }
    }

    updateFiltersUI();
    applyFilters(true);
  });

  const jobPool = state.activeApplications.filter(app => {
    const matchCompany = !state.selectedCompany || (app['Company Name'] || '').trim() === state.selectedCompany;
    const matchStatus = !state.selectedStatus || (app['Application Status'] || '').trim() === state.selectedStatus;
    return matchCompany && matchStatus;
  });

  const distinctJobs = [...new Set(
    jobPool.map(app => (app['Job Title'] || '').trim()).filter(title => title !== '')
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  jobSelect.populate(distinctJobs, state.selectedJobTitle, (jobTitle) => {
    state.selectedJobTitle = jobTitle;

    if (state.selectedJobTitle) {
      const matchingApp = state.activeApplications.find(app => (app['Job Title'] || '').trim() === state.selectedJobTitle);
      if (matchingApp) {
        state.selectedCompany = (matchingApp['Company Name'] || '').trim();
      }
    }

    updateFiltersUI();
    applyFilters(true);
  });

  const statusPool = state.activeApplications.filter(app => {
    const matchCompany = !state.selectedCompany || (app['Company Name'] || '').trim() === state.selectedCompany;
    const matchJob = !state.selectedJobTitle || (app['Job Title'] || '').trim() === state.selectedJobTitle;
    return matchCompany && matchJob;
  });

  const distinctStatuses = [...new Set(
    statusPool.map(app => (app['Application Status'] || '').trim()).filter(status => status !== '')
  )].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  statusSelect.populate(distinctStatuses, state.selectedStatus, (statusValue) => {
    state.selectedStatus = statusValue;
    updateFiltersUI();
    applyFilters(true);
  });
}

function applyFilters(resetPage = true) {
  if (resetPage) {
    state.currentPage = 1;
  }

  dom.btnResetFilters.disabled = !state.selectedCompany && !state.selectedJobTitle && !state.selectedStatus;

  state.filteredApplications = state.activeApplications.filter(app => {
    const matchCompany = !state.selectedCompany || (app['Company Name'] || '').trim() === state.selectedCompany;
    const matchJob = !state.selectedJobTitle || (app['Job Title'] || '').trim() === state.selectedJobTitle;
    const matchStatus = !state.selectedStatus || (app['Application Status'] || '').trim() === state.selectedStatus;
    return matchCompany && matchJob && matchStatus;
  });

  const sortVal = state.currentSortVal;
  state.filteredApplications.sort((a, b) => {
    let comparison = 0;
    
    if (sortVal.startsWith('date')) {
      const dateA = parseDate(a['Create Date']);
      const dateB = parseDate(b['Create Date']);
      comparison = dateA - dateB;
      if (sortVal === 'date-desc') {
        comparison = dateB - dateA;
      }
    } else if (sortVal.startsWith('job')) {
      const jobA = (a['Job Title'] || '').trim();
      const jobB = (b['Job Title'] || '').trim();
      comparison = jobA.localeCompare(jobB, undefined, { sensitivity: 'base', numeric: true });
      if (sortVal === 'job-desc') {
        comparison = jobB.localeCompare(jobA, undefined, { sensitivity: 'base', numeric: true });
      }
    } else if (sortVal.startsWith('company')) {
      const companyA = (a['Company Name'] || '').trim();
      const companyB = (b['Company Name'] || '').trim();
      comparison = companyA.localeCompare(companyB, undefined, { sensitivity: 'base', numeric: true });
      if (sortVal === 'company-desc') {
        comparison = companyB.localeCompare(companyA, undefined, { sensitivity: 'base', numeric: true });
      }
    } else if (sortVal.startsWith('status')) {
      const statusA = (a['Application Status'] || '').trim();
      const statusB = (b['Application Status'] || '').trim();
      comparison = statusA.localeCompare(statusB, undefined, { sensitivity: 'base', numeric: true });
      if (sortVal === 'status-desc') {
        comparison = statusB.localeCompare(statusA, undefined, { sensitivity: 'base', numeric: true });
      }
    } else if (sortVal.startsWith('suitability')) {
      const valA = (a['Job_Suitability'] || '').trim();
      const valB = (b['Job_Suitability'] || '').trim();
      const numA = parseInt(valA, 10);
      const numB = parseInt(valB, 10);
      
      const isNaN_A = isNaN(numA);
      const isNaN_B = isNaN(numB);
      
      if (isNaN_A && isNaN_B) {
        comparison = 0;
      } else if (isNaN_A) {
        comparison = 1;
      } else if (isNaN_B) {
        comparison = -1;
      } else {
        comparison = sortVal === 'suitability-desc' ? numB - numA : numA - numB;
      }
    }
    
    return comparison;
  });

  renderTable();
  if (typeof state.rawApplications !== 'undefined' && state.rawApplications.length > 0) {
    renderActiveInterviewsPanel(state.rawApplications);
  }
}

function updateHeaderSortIndicators() {
  const currentVal = state.currentSortVal;
  const [currentField, currentDir] = currentVal.split('-');
  
  document.querySelectorAll('.sortable-header').forEach(header => {
    const field = header.getAttribute('data-sort-field');
    const icon = header.querySelector('.sort-icon');
    if (icon) {
      icon.className = 'sort-icon';
      if (field === currentField) {
        icon.classList.add(currentDir);
      }
    }
  });
}

function renderTable() {
  if (!dom.registryTableBody) return;
  dom.registryTableBody.innerHTML = '';
  if (dom.resultsCount) dom.resultsCount.textContent = state.filteredApplications.length;

  if (state.filteredApplications.length === 0) {
    dom.noResults.classList.remove('hidden');
    if (dom.registryTableContainer) dom.registryTableContainer.style.display = 'none';
    return;
  }

  dom.noResults.classList.add('hidden');
  if (dom.registryTableContainer) dom.registryTableContainer.style.display = '';

  const totalRows = state.filteredApplications.length;
  const maxPage = Math.ceil(totalRows / state.rowsPerPage) || 1;
  
  if (state.currentPage > maxPage) {
    state.currentPage = maxPage;
  }
  if (state.currentPage < 1) {
    state.currentPage = 1;
  }

  const startIdx = (state.currentPage - 1) * state.rowsPerPage;
  const endIdx = Math.min(startIdx + state.rowsPerPage, totalRows);

  const pageApplications = state.filteredApplications.slice(startIdx, endIdx);

  const frag = document.createDocumentFragment();
  pageApplications.forEach((app, idx) => {
    const row = document.createElement('tr');
    row.setAttribute('data-index', startIdx + idx); // Store index for event delegation
    
    const company = (app['Company Name'] || '').trim();
    const title = (app['Job Title'] || '').trim();
    const status = (app['Application Status'] || '').trim();
    const dateStr = (app['Create Date'] || '').trim();
    const suitabilityScore = (app['Job_Suitability'] || '').trim();
    const scoreNum = parseInt(suitabilityScore, 10);
    const scoreClass = !isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5 ? `score-${scoreNum}` : '';
    
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');

    row.innerHTML = `
      <td><span class="table-job-title">${escapeHtml(title)}</span></td>
      <td><span class="table-company">${escapeHtml(company)}</span></td>
      <td><span class="status-badge ${statusClass}">${escapeHtml(status)}</span></td>
      <td><span class="table-date">${escapeHtml(formatDisplayDate(dateStr))}</span></td>
      <td>
        ${suitabilityScore ? `<span class="score-badge ${scoreClass}">Score: ${escapeHtml(suitabilityScore)}</span>` : '<span style="color: var(--color-text-secondary)">-</span>'}
      </td>
      <td>
        <button type="button" class="table-action-btn">
          View Detail
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </td>
    `;

    frag.appendChild(row);
  });
  dom.registryTableBody.appendChild(frag);

  if (dom.paginationInfo) {
    dom.paginationInfo.textContent = `Showing ${totalRows === 0 ? 0 : startIdx + 1} to ${endIdx} of ${totalRows} applications`;
  }
  
  if (dom.btnPrevPage) {
    dom.btnPrevPage.disabled = state.currentPage === 1;
  }
  if (dom.btnNextPage) {
    dom.btnNextPage.disabled = state.currentPage === maxPage;
  }

  updateHeaderSortIndicators();
}

function selectTab(tabId) {
  const tabs = document.querySelectorAll('.drawer-tab');
  const panes = document.querySelectorAll('.drawer-tab-pane');
  
  tabs.forEach(tab => {
    if (tab.id === tabId) {
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
    } else {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    }
  });
  
  const selectedTabEl = document.getElementById(tabId);
  const targetPaneId = selectedTabEl ? selectedTabEl.getAttribute('aria-controls') : '';
  
  panes.forEach(pane => {
    if (pane.id === targetPaneId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });
}

function openDetailsDrawer(app) {
  state.currentApp = app;

  const status = (app['Application Status'] || '').trim();
  dom.drawerStatusBadge.className = `badge status-badge ${status.toLowerCase().replace(/\s+/g, '-')}`;
  dom.drawerStatusBadge.textContent = status;
  
  const jobTitleVal = (app['Job Title'] || '').trim();
  const companyVal  = (app['Company Name'] || '').trim();

  if (dom.drawerJobTitleDisplay)   dom.drawerJobTitleDisplay.textContent   = jobTitleVal;
  if (dom.drawerCompanyNameDisplay) dom.drawerCompanyNameDisplay.textContent = companyVal;
  if (dom.drawerJobTitle)          dom.drawerJobTitle.value                = jobTitleVal;
  if (dom.drawerCompanyName)        dom.drawerCompanyName.value              = companyVal;
  dom.drawerDate.textContent = formatDisplayDate((app['Create Date'] || '').trim());
  
  const hiringTeamVal = (app['Hiring Team'] || '').trim();
  if (hiringTeamVal) {
    const isUrl = hiringTeamVal.startsWith('http://') || hiringTeamVal.startsWith('https://');
    if (isUrl) {
      dom.drawerHiringTeam.innerHTML = `<a href="${escapeHtml(hiringTeamVal)}" target="_blank" class="inline-link-btn">
        <svg aria-hidden="true" width="14" height="14"><use href="#icon-external-link"/></svg>
        Link
      </a>`;
    } else {
      dom.drawerHiringTeam.textContent = hiringTeamVal;
    }
  } else {
    dom.drawerHiringTeam.textContent = '-';
  }

  const followUpVal = (app['Follow-Up'] || '').trim();
  if (followUpVal) {
    const isUrl = followUpVal.startsWith('http://') || followUpVal.startsWith('https://');
    if (isUrl) {
      dom.drawerFollowUp.innerHTML = `<a href="${escapeHtml(followUpVal)}" target="_blank" class="inline-link-btn">
        <svg aria-hidden="true" width="14" height="14"><use href="#icon-external-link"/></svg>
        Link
      </a>`;
    } else {
      dom.drawerFollowUp.textContent = followUpVal;
    }
  } else {
    dom.drawerFollowUp.textContent = '-';
  }
  
  const score = (app['Job_Suitability'] || '').trim();
  const evaluation = (app['Job_Suitability_Evaluation'] || '').trim();
  const tabSuitability = document.getElementById('tabSuitability');
  
  const hasSuitability = !!(score || evaluation);
  if (hasSuitability) {
    if (tabSuitability) {
      tabSuitability.classList.remove('disabled');
      tabSuitability.removeAttribute('disabled');
    }
    
    const fillElement = document.getElementById('scoreCircleFill');
    const circleContainer = document.getElementById('suitabilityScoreCircle');
    
    if (score) {
      dom.drawerSuitabilityScore.textContent = score;
      const scoreNum = parseInt(score, 10);
      const scoreClass = !isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5 ? `score-${scoreNum}` : '';
      
      if (circleContainer) {
        circleContainer.className = `suitability-score-circle ${scoreClass}`;
      }
      
      if (fillElement) {
        const scorePercent = !isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5 ? scoreNum / 5 : 0;
        fillElement.style.strokeDashoffset = 251.2 * (1 - scorePercent);
      }
      
      dom.drawerSuitabilityScoreContainer.style.display = '';
    } else {
      dom.drawerSuitabilityScoreContainer.style.display = 'none';
      if (fillElement) fillElement.style.strokeDashoffset = 251.2;
      if (circleContainer) circleContainer.className = 'suitability-score-circle';
    }

    if (evaluation) {
      dom.drawerSuitabilityEval.textContent = evaluation;
      dom.sectionSuitabilityEval.classList.remove('hidden');
    } else {
      dom.sectionSuitabilityEval.classList.add('hidden');
    }
  } else {
    if (tabSuitability) {
      tabSuitability.classList.add('disabled');
      tabSuitability.setAttribute('disabled', 'true');
    }
  }

  const comments = (app['Comments'] || '').trim();
  dom.drawerComments.innerHTML = comments ? parseMarkdown(comments) : '-';

  dom.drawerJobDescription.textContent = (app['Job Description'] || 'Not available.').trim();
  dom.drawerCompanyDescription.textContent = (app['Company Description'] || 'Not available.').trim();

  const jobUrl = (app['Job URL'] || '').trim();
  if (dom.linkJobUrl) dom.linkJobUrl.value = jobUrl;
  if (dom.linkJobUrlAnchor) {
    if (jobUrl) { dom.linkJobUrlAnchor.href = jobUrl; dom.linkJobUrlAnchor.style.display = ''; }
    else        { dom.linkJobUrlAnchor.style.display = 'none'; }
  }

  const companyFolder = (app['Company_Folder'] || '').trim();
  if (dom.linkCompanyFolder) {
    if (companyFolder) {
      dom.linkCompanyFolder.href = companyFolder;
      dom.linkCompanyFolder.style.display = '';
    } else {
      dom.linkCompanyFolder.style.display = 'none';
    }
  }

  const interviewCompany = (app['Interview_Company'] || '').trim();
  const interviewPrep = (app['Interview_Preparation'] || '').trim();
  const tabInterview = document.getElementById('tabInterview');

  const hasInterview = !!(interviewCompany || interviewPrep);
  if (hasInterview) {
    if (tabInterview) {
      tabInterview.classList.remove('disabled');
      tabInterview.removeAttribute('disabled');
    }

    const btnCopyCompany = document.getElementById('btnCopyInterviewCompany');
    const btnCopyPrep = document.getElementById('btnCopyInterviewPreparation');

    dom.drawerInterviewCompany.innerHTML = interviewCompany ? parseMarkdown(interviewCompany) : '-';
    if (btnCopyCompany) btnCopyCompany.style.display = interviewCompany ? '' : 'none';

    dom.drawerInterviewPreparation.innerHTML = interviewPrep ? parseMarkdown(interviewPrep) : '-';
    if (btnCopyPrep) btnCopyPrep.style.display = interviewPrep ? '' : 'none';

    const notesEl = document.getElementById('inputInterviewNotes');
    if (notesEl) notesEl.value = (app['Interview_Notes'] || '').trim();

    setInterviewLoadingState(false);
  } else {
    if (tabInterview) {
      tabInterview.classList.add('disabled');
      tabInterview.setAttribute('disabled', 'true');
    }
  }

  selectTab('tabOverview');

  dom.drawerOverlay.classList.add('active');
  dom.detailsDrawer.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  dom.detailsDrawer.querySelector('.drawer-body').scrollTop = 0;
}

function closeDetailsDrawer() {
  dom.drawerOverlay.classList.remove('active');
  dom.detailsDrawer.classList.remove('active');
  document.body.style.overflow = '';
}

function showEl(el) { if (el) el.classList.remove('tab-hidden'); }
function hideEl(el) { if (el) el.classList.add('tab-hidden'); }

function initScrollReveal() {
  const revealElements = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  revealElements.forEach(el => {
    observer.observe(el);
  });
}

function initTabNavigation() {
  function switchTab(targetTab) {
    // Check if we need to auto-refresh data (if 15 min passed since last sync)
    if (targetTab === 'home' || targetTab === 'dashboard') {
      try {
        const cachedVal = localStorage.getItem(CSV_CACHE_KEY);
        if (cachedVal) {
          const cachedObj = JSON.parse(cachedVal);
          if (cachedObj && cachedObj.timestamp) {
            const timeDiffMs = Date.now() - cachedObj.timestamp;
            const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
            if (timeDiffMs >= FIFTEEN_MINUTES_MS) {
              console.log('[OpportunityTracker] Auto-refreshing data on tab switch (15+ min passed)');
              fetchData();
            }
          }
        }
      } catch (e) {
        console.error('[OpportunityTracker] Failed to check cache for auto-refresh:', e);
      }
    }

    // Scroll to top on tab switch
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const navButtons = document.querySelectorAll('.topbar-nav-btn');
    navButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === targetTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (dom.fabBtn) {
      if (targetTab === 'landing' || targetTab === 'new-application' || targetTab === 'resume') {
        dom.fabBtn.style.display = 'none';
        if (dom.refreshBtn) dom.refreshBtn.style.display = 'none';
      } else {
        dom.fabBtn.style.display = 'flex';
        if (dom.refreshBtn) dom.refreshBtn.style.display = 'flex';
      }
    }

    if (targetTab === 'landing') {
      showEl(dom.landingTabContent);
      hideEl(dom.heroBanner);
      hideEl(dom.filtersSection);
      hideEl(dom.resultsSection);
      hideEl(dom.activeInterviewsSection);
      hideEl(dom.syncContainer);
      hideEl(dom.statsSection);
      hideEl(dom.analyticsSection);
      hideEl(dom.newApplicationSection);
      hideEl(dom.resumeSection);
    } else if (targetTab === 'home') {
      hideEl(dom.landingTabContent);
      hideEl(dom.heroBanner);
      showEl(dom.filtersSection);
      showEl(dom.resultsSection);
      showEl(dom.syncContainer);
      if (state.rawApplications.length > 0) renderActiveInterviewsPanel(state.rawApplications);
      hideEl(dom.statsSection);
      hideEl(dom.analyticsSection);
      hideEl(dom.newApplicationSection);
      hideEl(dom.resumeSection);
    } else if (targetTab === 'dashboard') {
      hideEl(dom.landingTabContent);
      hideEl(dom.heroBanner);
      hideEl(dom.filtersSection);
      hideEl(dom.resultsSection);
      hideEl(dom.activeInterviewsSection);
      showEl(dom.syncContainer);
      showEl(dom.statsSection);
      showEl(dom.analyticsSection);
      hideEl(dom.newApplicationSection);
      hideEl(dom.resumeSection);

      if (state.rawApplications.length > 0) {
        try {
          renderAllDashboardWidgets(state.rawApplications);
        } catch (error) {
          console.error("Failed to render dashboard widgets on tab switch:", error);
        }
      }
    } else if (targetTab === 'new-application') {
      hideEl(dom.landingTabContent);
      hideEl(dom.heroBanner);
      hideEl(dom.filtersSection);
      hideEl(dom.resultsSection);
      hideEl(dom.activeInterviewsSection);
      hideEl(dom.syncContainer);
      hideEl(dom.statsSection);
      hideEl(dom.analyticsSection);
      showEl(dom.newApplicationSection);
      hideEl(dom.resumeSection);

      if (!window._formApp) {
        window._formApp = new FormApp();
      }
    } else if (targetTab === 'resume') {
      hideEl(dom.landingTabContent);
      hideEl(dom.heroBanner);
      hideEl(dom.filtersSection);
      hideEl(dom.resultsSection);
      hideEl(dom.activeInterviewsSection);
      hideEl(dom.syncContainer);
      hideEl(dom.statsSection);
      hideEl(dom.analyticsSection);
      hideEl(dom.newApplicationSection);
      showEl(dom.resumeSection);

      // Trigger Resume animations
      if (window._resumeApp && window._resumeApp.onTabActivated) {
        window._resumeApp.onTabActivated();
      }
    }
  }

  window.switchTab = switchTab;

  const navButtons = document.querySelectorAll('.topbar-nav-btn');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');
      switchTab(target);
    });
  });

  if (dom.fabBtn) {
    dom.fabBtn.addEventListener('click', () => {
      switchTab('new-application');
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const startTab = urlParams.get('tab');
  if (startTab) {
    switchTab(startTab);
  } else {
    switchTab('landing');
  }
}

let isInterviewSubmitting = false;

function setInterviewLoadingState(isLoading) {
  const form = document.getElementById('jobinterview');
  if (form) {
    form.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }

  const elements = [
    document.getElementById('btnSubmitInterviewNotes'),
    document.getElementById('btnResetInterviewNotes'),
    document.getElementById('inputInterviewNotes')
  ];
  elements.forEach(el => {
    if (el) el.disabled = isLoading;
  });
}

async function submitJobInterviewForm() {
  const form = document.getElementById('jobinterview');
  if (!form) return;

  if (isInterviewSubmitting) return;

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    showToast('Please fill in all required fields correctly.', 'warning');
    return;
  }

  isInterviewSubmitting = true;
  showToast('Submitting your notes... Please wait for feedback.', 'info');

  await postForm(NOTES_API_ENDPOINT, new FormData(form), {
    setLoading: (v) => setInterviewLoadingState(v),
    onSuccess: () => {
      form.classList.remove('was-validated');
      showToast('Notes submitted successfully!', 'success');
      if (state.currentApp) {
        const notesEl = document.getElementById('inputInterviewNotes');
        state.currentApp['Interview_Notes'] = notesEl ? notesEl.value.trim() : '';
      }
      setTimeout(fetchData, 3000);
    },
    onError: (e) => {
      showToast(e.name === 'AbortError'
        ? 'Submission error: Request timed out after 90 seconds.'
        : 'Submission error: ' + e.message,
        'error');
    },
  });

  isInterviewSubmitting = false;
}

function renderActiveInterviewsPanel(applications) {
  if (!dom.activeInterviewsSection || !dom.activeInterviewsGrid) return;
  
  const activeApps = applications.filter(app => {
    const status = (app['Application Status'] || '').trim().toLowerCase();
    const isActive = status !== '' && status !== 'ready' && status !== 'rejected' && status !== 'withdraw' && status !== 'withdrawn' && status !== 'applied';
    
    const matchCompany = !state.selectedCompany || (app['Company Name'] || '').trim() === state.selectedCompany;
    const matchJob = !state.selectedJobTitle || (app['Job Title'] || '').trim() === state.selectedJobTitle;
    const matchStatus = !state.selectedStatus || (app['Application Status'] || '').trim() === state.selectedStatus;
    
    return isActive && matchCompany && matchJob && matchStatus;
  });
  
  const activeTabBtn = document.querySelector('.topbar-nav-btn.active');
  const isHomeTab = activeTabBtn ? activeTabBtn.getAttribute('data-tab') === 'home' : true;
  const hasActiveFilters = !!(state.selectedCompany || state.selectedJobTitle || state.selectedStatus);
  
  if (activeApps.length === 0 || !isHomeTab) {
    if (isHomeTab && hasActiveFilters) {
      dom.activeInterviewsSection.classList.remove('tab-hidden');
      if (dom.activeInterviewsCount) dom.activeInterviewsCount.textContent = '0';
      dom.activeInterviewsGrid.innerHTML = '<div class="no-results-pipeline">No results found for this filter.</div>';
      return;
    }
    dom.activeInterviewsSection.classList.add('tab-hidden');
    return;
  }
  
  dom.activeInterviewsSection.classList.remove('tab-hidden');
  if (dom.activeInterviewsCount) {
    dom.activeInterviewsCount.textContent = activeApps.length;
  }
  dom.activeInterviewsGrid.innerHTML = '';
  
  activeApps.forEach(app => {
    const company = (app['Company Name'] || '').trim();
    const title = (app['Job Title'] || '').trim();
    const status = (app['Application Status'] || '').trim();
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');
    const commentsVal = (app['Comments'] || '').trim();
    const followUpVal = (app['Follow-Up'] || '').trim();
    
    const lastCommentLine = getLastComment(commentsVal);
    const formattedComment = parseCommentLine(lastCommentLine);
    
    let followUpHtml = '';
    if (followUpVal) {
      const isUrl = followUpVal.startsWith('http://') || followUpVal.startsWith('https://');
      if (isUrl) {
        followUpHtml = `
          <a href="${escapeHtml(followUpVal)}" target="_blank" class="interview-btn">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
            Follow Up
          </a>`;
      } else {
        followUpHtml = `<span class="followup-text">Follow Up: ${escapeHtml(followUpVal)}</span>`;
      }
    }
    
    const card = document.createElement('div');
    card.className = 'interview-card';
    card.setAttribute('data-company', company);
    card.setAttribute('data-title', title);
    card.innerHTML = `
      <div class="interview-card-header">
        <div>
          <h4 class="interview-company">${escapeHtml(company)}</h4>
          <p class="interview-title">${escapeHtml(title)}</p>
        </div>
        <span class="status-badge ${statusClass}">${escapeHtml(status)}</span>
      </div>
      <div class="interview-card-body">
        <div class="interview-latest-activity">
          <span class="activity-label">Latest Activity</span>
          <div class="activity-content">${formattedComment}</div>
        </div>
      </div>
      <div class="interview-card-footer">
        ${followUpHtml}
        <button type="button" class="interview-btn secondary view-detail-trigger">
          View Details
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>
    `;
    
    dom.activeInterviewsGrid.appendChild(card);
  });
}

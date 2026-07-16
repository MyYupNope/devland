import { FacetedSelect } from './FacetedSelect.js';
import { FormApp } from './FormApp.js';
import { state } from './State.js?v=4';
import { resumeApp } from './Resume.js';
import { renderAllDashboardWidgets } from './Charts.js?v=3';
import { parseMarkdown } from './Markdown.js';
import { showToast } from './Toast.js';
import {
  escapeHtml,
  parseDate,
  formatDisplayDate,
  postForm,
  getLastComment,
  parseCommentLine,
  parseCacheTimestamp
} from './Utils.js';
import {
  SHEET_EXPORT_URL,
  NOTES_API_ENDPOINT,
  CSV_CACHE_KEY
} from './Config.js';

/* --------------------------------------------------------------------------
   LANDING HERO: CANVAS PARTICLE NETWORK
   Adapted from Resume.js particle system — scoped to the Home/Landing tab.
   -------------------------------------------------------------------------- */
class LandingParticles {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.particles = [];
    this.animationFrameId = null;
    this.isActive = false;
    this._cachedColor = null;
    this._lastThemeClass = '';
    this.handleResize = this._onResize.bind(this);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.canvas = document.getElementById('landingHeroCanvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this._onResize(true);
    this.particles = this._createParticles();
    this._animate();
    window.addEventListener('resize', this.handleResize);
  }

  stop() {
    this.isActive = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this.handleResize);
  }

  _createParticles() {
    const particles = [];
    const count = window.innerWidth < 768 ? 30 : 60;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.8 + 0.8
      });
    }
    return particles;
  }

  _onResize(immediate = false) {
    if (this._resizeTimeout) clearTimeout(this._resizeTimeout);
    const doResize = () => {
      if (!this.canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const parent = this.canvas.parentElement;
      this.canvas.width = parent.clientWidth * dpr;
      this.canvas.height = parent.clientHeight * dpr;
      if (this.ctx) {
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
      }
    };
    if (immediate) doResize();
    else this._resizeTimeout = setTimeout(doResize, 150);
  }

  _getColorRgb() {
    try {
      const style = getComputedStyle(document.documentElement);
      let color = style.getPropertyValue('--color-primary').trim();
      if (color.startsWith('#')) {
        let hex = color.substring(1);
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        return {
          r: parseInt(hex.substring(0, 2), 16),
          g: parseInt(hex.substring(2, 4), 16),
          b: parseInt(hex.substring(4, 6), 16)
        };
      }
    } catch (e) { /* fallback */ }
    return { r: 59, g: 130, b: 246 }; // Default blue fallback
  }

  _animate() {
    if (!this.isActive) return;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    this.ctx.clearRect(0, 0, width, height);

    const themeClass = document.documentElement.className;
    if (this._lastThemeClass !== themeClass || !this._cachedColor) {
      this._lastThemeClass = themeClass;
      this._cachedColor = this._getColorRgb();
    }
    const c = this._cachedColor;

    // Update and draw particles
    this.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, 0.55)`;
      this.ctx.fill();
    });

    // Draw connecting lines
    const maxDist = 120;
    const maxDistSq = maxDist * maxDist;
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq);
          const alpha = (1 - dist / maxDist) * 0.25;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
          this.ctx.lineWidth = 1;
          this.ctx.stroke();
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this._animate());
  }
}

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
  dom.drawerJobTitleDisplay = document.getElementById('drawerJobTitleDisplay');
  dom.drawerCompanyNameDisplay = document.getElementById('drawerCompanyNameDisplay');
  dom.drawerJobTitle = document.getElementById('drawerJobTitle');
  dom.drawerCompanyName = document.getElementById('drawerCompanyName');
  dom.drawerDate = document.getElementById('drawerDate');
  dom.drawerHiringTeam = document.getElementById('drawerHiringTeam');
  dom.drawerHiringTeamLink = document.getElementById('drawerHiringTeamLink');
  dom.drawerFollowUp = document.getElementById('drawerFollowUp');
  dom.drawerFollowUpLink = document.getElementById('drawerFollowUpLink');
  dom.drawerSuitabilityScoreContainer = document.getElementById('drawerSuitabilityScoreContainer');
  dom.drawerSuitabilityScore = document.getElementById('drawerSuitabilityScore');
  dom.drawerSuitabilityEval = document.getElementById('drawerSuitabilityEval');
  dom.sectionSuitabilityEval = document.getElementById('sectionSuitabilityEval');
  dom.drawerStatusSelect = document.getElementById('drawerStatusSelect');
  dom.drawerCommentsTextarea = document.getElementById('drawerCommentsTextarea');
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

  dom.tabSuitability = document.getElementById('tabSuitability');
  dom.scoreCircleFill = document.getElementById('scoreCircleFill');
  dom.suitabilityScoreCircle = document.getElementById('suitabilityScoreCircle');
  dom.tabInterview = document.getElementById('tabInterview');
  dom.btnCopyInterviewCompany = document.getElementById('btnCopyInterviewCompany');
  dom.btnCopyInterviewPreparation = document.getElementById('btnCopyInterviewPreparation');
  dom.drawerInterviewNotes = document.getElementById('drawerInterviewNotes');
  dom.jobInterviewForm = document.getElementById('jobinterview');
  dom.btnSubmitInterviewNotes = document.getElementById('btnSubmitInterviewNotes');
  dom.btnResetInterviewNotes = document.getElementById('btnResetInterviewNotes');
  dom.btnSubmitOverviewUpdates = document.getElementById('btnSubmitOverviewUpdates');
  dom.themeToggleBtn = document.getElementById('themeToggleBtn');
  dom.dashboardRangeToggle = document.getElementById('dashboardRangeToggle');
  dom.statCardThisMonth = document.getElementById('statCardThisMonth');
  dom.globalDashboardRangeContainer = document.getElementById('globalDashboardRangeContainer');
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
  if (dom.themeToggleBtn) {
    dom.themeToggleBtn.addEventListener('click', () => {
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

  // Dashboard Range Switch Toggle Button
  if (dom.dashboardRangeToggle) {
    dom.dashboardRangeToggle.addEventListener('click', () => {
      const isYearly = dom.dashboardRangeToggle.classList.contains('active');
      if (isYearly) {
        dom.dashboardRangeToggle.classList.remove('active');
        state.dashboardRange = 'weekly';
      } else {
        dom.dashboardRangeToggle.classList.add('active');
        state.dashboardRange = 'yearly';
      }
      localStorage.setItem('dashboardRange', state.dashboardRange);
      
      const filtered = getFilteredDashboardApps(state.dashboardRange);
      calculateStatistics(filtered);
      renderAllDashboardWidgets(filtered, true);
    });
  }


  // Refresh Button (Forces a manual reload and re-parse of the data)
  if (dom.refreshBtn) {
    dom.refreshBtn.addEventListener('click', () => {
      fetchData(false, true);
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
  if (dom.btnResetInterviewNotes) {
    dom.btnResetInterviewNotes.addEventListener('click', () => {
      const inp = dom.drawerInterviewNotes;
      if (inp) {
        inp.value = '';
        showToast('Interview notes reset', 'info');
      }
    });
  }

  // Submit notes event listener
  const formJobInterview = dom.jobInterviewForm;
  if (formJobInterview) {
    formJobInterview.addEventListener('submit', (e) => {
      e.preventDefault();

      const submitter = e.submitter;
      if (submitter && submitter.id === 'btnSubmitOverviewUpdates') {
        submitJobInterviewForm(submitter.id);
        return;
      }

      submitJobInterviewForm(submitter ? submitter.id : null);
    });
  }

  // Drawer Close Actions
  if (dom.btnCloseDrawer) dom.btnCloseDrawer.addEventListener('click', closeDetailsDrawer);
  if (dom.drawerOverlay) dom.drawerOverlay.addEventListener('click', closeDetailsDrawer);
  
  if (dom.drawerStatusSelect) {
    dom.drawerStatusSelect.addEventListener('change', () => {
      updateSelectColorClass(dom.drawerStatusSelect);
    });
  }

  if (dom.drawerFollowUp) {
    dom.drawerFollowUp.addEventListener('input', updateFollowUpLink);
  }

  if (dom.drawerHiringTeam) {
    dom.drawerHiringTeam.addEventListener('input', updateHiringTeamLink);
  }
  
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
function fetchData(isTabSwitch = false, isForceRefresh = false) {
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const cachedVal = localStorage.getItem(CACHE_KEY_CSV());
  let cachedCsvText = null;
  let hasLoadedFromCache = false;
  let lastSyncTimeMs = null;

  if (cachedVal) {
    try {
      const cachedObj = JSON.parse(cachedVal);
      if (cachedObj && typeof cachedObj === 'object' && cachedObj.csv && cachedObj.timestamp) {
        lastSyncTimeMs = parseCacheTimestamp(cachedObj.timestamp);
        if (Date.now() - cachedObj.timestamp < CACHE_TTL_MS) {
          cachedCsvText = cachedObj.csv;
        } else {
          console.log('[OpportunityTracker] Cache expired');
        }
      } else if (typeof cachedVal === 'string' && !cachedVal.startsWith('{')) {
        cachedCsvText = cachedVal;
      }
    } catch (e) {
      if (typeof cachedVal === 'string' && !cachedVal.startsWith('{')) {
        cachedCsvText = cachedVal;
      }
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

  if (isTabSwitch && hasLoadedFromCache && lastSyncTimeMs) {
    const timeDiffMs = Date.now() - lastSyncTimeMs;
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    if (timeDiffMs < FIFTEEN_MINUTES_MS) {
      console.log('[OpportunityTracker] Skipping fetch request on tab switch (last sync was < 15 min ago)');
      const lastUpdated = new Date(lastSyncTimeMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      setSyncState('success', `Synced ${lastUpdated}`);
      return; // Skip fetch since cache is fresh
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
      
      const cachedVal = localStorage.getItem(CACHE_KEY_CSV());
      let parsedCached = null;
      if (cachedVal) {
        try {
          parsedCached = JSON.parse(cachedVal);
        } catch (e) {}
      }

      if (!isForceRefresh && parsedCached && parsedCached.csv === csvText) {
        console.log('[OpportunityTracker] Remote CSV is identical to cache. Skipping parse.');
        // Update cache timestamp to mark it fresh
        try {
          const newCache = { csv: csvText, timestamp: Date.now() };
          localStorage.setItem(CACHE_KEY_CSV(), JSON.stringify(newCache));
        } catch (e) {}
        const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        setSyncState('success', `Synced ${lastUpdated}`);
        // If we haven't loaded the data yet (e.g. cache expired or disabled but string identical), render once
        if (!hasLoadedFromCache || !state.rawApplications || state.rawApplications.length === 0) {
          parseAndInitializeData(csvText);
        }
        return;
      }

      try {
        const newCache = { csv: csvText, timestamp: Date.now() };
        localStorage.setItem(CACHE_KEY_CSV(), JSON.stringify(newCache));
      } catch (e) {
        console.warn('[OpportunityTracker] Failed to write cache to localStorage:', e);
      }

      parseAndInitializeData(csvText);
      
      const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      setSyncState('success', `Synced ${lastUpdated}`);
    })
    .catch(error => {
      console.error('[OpportunityTracker] Fetch error:', error);
      if (hasLoadedFromCache) {
        let cachedObj = {};
        try {
          cachedObj = JSON.parse(localStorage.getItem(CACHE_KEY_CSV()) || '{}');
        } catch (e) {}
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
      let val = row[index] !== undefined ? row[index].trim() : '';
      if (header === 'Application Status') {
        const lower = val.toLowerCase();
        if (lower === 'interviews' || lower === 'interview') {
          val = 'Interviewed';
        }
      }
      app[header] = val;
    });
    app.originalIndex = i;
    app._parsedDate = parseDate(app['Create Date']);
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
    const status = app['Application Status'].toLowerCase();
    return status !== 'rejected' && status !== 'withdrawn';
  });

  state.dataVersion++;
  updateFiltersUI();
  applyFilters(true);

  const range = state.dashboardRange || 'yearly';
  const filtered = getFilteredDashboardApps(range);
  calculateStatistics(filtered);

  // Render dashboard range toggle switch UI state
  if (dom.dashboardRangeToggle) {
    if (range === 'yearly') {
      dom.dashboardRangeToggle.classList.add('active');
    } else {
      dom.dashboardRangeToggle.classList.remove('active');
    }
  }

  // Render all dashboard widgets
  renderAllDashboardWidgets(filtered, true);
}

function getFilteredDashboardApps(range) {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  let cutoff;

  if (range === 'weekly') {
    // Current week from Monday until Sunday
    const day = today.getDay();
    const distanceToMonday = day === 0 ? 6 : day - 1;
    cutoff = new Date(today);
    cutoff.setDate(today.getDate() - distanceToMonday);
    cutoff.setHours(0, 0, 0, 0);
  } else {
    // Yearly (YTD) — January 1st of current year
    cutoff = new Date(today.getFullYear(), 0, 1);
    cutoff.setHours(0, 0, 0, 0);
  }

  return state.rawApplications.filter(app => {
    const dateStr = (app['Create Date'] || '').trim();
    if (!dateStr) return false;
    const appDate = parseDate(dateStr);
    return appDate >= cutoff && appDate <= today;
  });
}

/**
 * Optimized dashboard statistics calculation in a single-pass loop.
 */
function calculateStatistics(apps = state.rawApplications) {
  if (dom.statTotal) dom.statTotal.textContent = apps.length;

  const activeAppsSubset = apps.filter(app => {
    const status = (app['Application Status'] || '').trim().toLowerCase();
    return status !== 'rejected' && status !== 'withdrawn';
  });
  if (dom.statActivePipeline) dom.statActivePipeline.textContent = activeAppsSubset.length;

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

  apps.forEach(app => {
    const company = (app['Company Name'] || '').trim();
    if (company) uniqueCompanies.add(company);

    const job = (app['Job Title'] || '').trim();
    if (job) uniqueJobs.add(job);

    const status = (app['Application Status'] || '').trim().toLowerCase();
    const isActive = status !== '' && status !== 'ready' && status !== 'applied' && status !== 'rejected' && status !== 'withdrawn';
    if (isActive) {
      activeAppsCount++;
    }

    if (status.includes('interview')) {
      interviewCount++;
      conversionCount++;
    } else if (status === 'offered' || status === 'ready' || status === 'accepted') {
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
      if (state.dashboardRange === 'weekly') {
        // If range is weekly, we already filtered to only include this week
        appsThisWeek++;
        appsThisMonth++;
      } else {
        const appDate = parseDate(dateStr);
        appDate.setHours(0, 0, 0, 0);
        if (appDate >= startOfWeek) {
          appsThisWeek++;
        }
        if (appDate >= startOfMonth) {
          appsThisMonth++;
        }
      }
    }
  });

  if (dom.statCompanies) dom.statCompanies.textContent = uniqueCompanies.size;
  if (dom.statJobs) dom.statJobs.textContent = uniqueJobs.size;
  if (dom.statActiveApps) dom.statActiveApps.textContent = activeAppsCount;

  const conversionRate = apps.length > 0
    ? Math.round((conversionCount / apps.length) * 100)
    : 0;
  if (dom.statConversion) dom.statConversion.textContent = `${conversionRate}%`;

  const rejectionRate = apps.length > 0
    ? Math.round((rejectedCount / apps.length) * 100)
    : 0;
  if (dom.statRejectionRate) dom.statRejectionRate.textContent = `${rejectionRate}%`;

  const avgSuitability = suitabilityCount > 0 ? (totalSuitability / suitabilityCount).toFixed(1) : '0.0';
  if (dom.statAvgSuitability) dom.statAvgSuitability.textContent = `${avgSuitability}/5`;

  if (dom.statThisWeek) dom.statThisWeek.textContent = appsThisWeek;
  if (dom.statThisMonth) dom.statThisMonth.textContent = appsThisMonth;

  // Hide "Applied This Month" card in weekly view, show it in yearly (YTD) view
  if (dom.statCardThisMonth) {
    if (state.dashboardRange === 'weekly') {
      dom.statCardThisMonth.style.display = 'none';
    } else {
      dom.statCardThisMonth.style.display = '';
    }
  }
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
      
      if (state.selectedJobTitle) {
        const isValid = companyJobs.includes(state.selectedJobTitle);
        if (!isValid) {
          state.selectedJobTitle = null;
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
      const jobApps = state.activeApplications.filter(app => 
        (app['Job Title'] || '').trim() === state.selectedJobTitle
      );
      const jobCompanies = [...new Set(
        jobApps.map(app => (app['Company Name'] || '').trim()).filter(name => name !== '')
      )];
      
      if (state.selectedCompany) {
        const isValid = jobCompanies.includes(state.selectedCompany);
        if (!isValid) {
          state.selectedCompany = null;
        }
      }
    } else {
      if (state.selectedCompany) {
        const isValid = state.activeApplications.some(app => 
          (app['Company Name'] || '').trim() === state.selectedCompany
        );
        if (!isValid) {
          state.selectedCompany = null;
        }
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
    const matchCompany = !state.selectedCompany || app['Company Name'] === state.selectedCompany;
    const matchJob = !state.selectedJobTitle || app['Job Title'] === state.selectedJobTitle;
    const matchStatus = !state.selectedStatus || app['Application Status'] === state.selectedStatus;
    return matchCompany && matchJob && matchStatus;
  });

  const sortVal = state.currentSortVal;
  state.filteredApplications.sort((a, b) => {
    let comparison = 0;
    
    if (sortVal.startsWith('date')) {
      const dateA = a._parsedDate;
      const dateB = b._parsedDate;
      comparison = dateA - dateB;
      if (sortVal === 'date-desc') {
        comparison = dateB - dateA;
      }
      if (comparison === 0) {
        comparison = sortVal === 'date-desc'
          ? (b.originalIndex || 0) - (a.originalIndex || 0)
          : (a.originalIndex || 0) - (b.originalIndex || 0);
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
    
    if (comparison === 0) {
      return (b.originalIndex || 0) - (a.originalIndex || 0);
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

  const btnSubmitUpdates = document.getElementById('btnSubmitOverviewUpdates');
  if (btnSubmitUpdates) {
    btnSubmitUpdates.style.display = (tabId === 'tabOverview') ? '' : 'none';
  }

  const btnSubmitNotes = document.getElementById('btnSubmitInterviewNotes');
  if (btnSubmitNotes) {
    btnSubmitNotes.style.display = (tabId === 'tabInterview') ? '' : 'none';
  }
}

function updateSelectColorClass(select) {
  if (!select) return;
  select.classList.remove('status-ready', 'status-applied', 'status-interviewed', 'status-accepted', 'status-offered', 'status-rejected', 'status-withdrawn');
  const statusClass = select.value.toLowerCase().replace(/\s+/g, '-');
  select.classList.add(`status-${statusClass}`);
}

function updateFollowUpLink() {
  if (!dom.drawerFollowUp || !dom.drawerFollowUpLink) return;
  const val = dom.drawerFollowUp.value.trim();
  if (val) {
    let url = val;
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      url = 'https://' + val;
    }
    dom.drawerFollowUpLink.href = url;
    dom.drawerFollowUpLink.style.display = 'inline-flex';
  } else {
    dom.drawerFollowUpLink.style.display = 'none';
  }
}

function updateHiringTeamLink() {
  if (!dom.drawerHiringTeam || !dom.drawerHiringTeamLink) return;
  const val = dom.drawerHiringTeam.value.trim();
  const isNotDefined = val.toLowerCase() === 'not defined';
  if (val && !isNotDefined) {
    let url = val;
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      url = 'https://' + val;
    }
    dom.drawerHiringTeamLink.href = url;
    dom.drawerHiringTeamLink.style.display = 'inline-flex';
  } else {
    dom.drawerHiringTeamLink.style.display = 'none';
  }
}

function openDetailsDrawer(app) {
  state.currentApp = app;

  const status = (app['Application Status'] || '').trim();
  
  const jobTitleVal = (app['Job Title'] || '').trim();
  const companyVal  = (app['Company Name'] || '').trim();

  if (dom.drawerJobTitleDisplay)   dom.drawerJobTitleDisplay.textContent   = jobTitleVal;
  if (dom.drawerCompanyNameDisplay) dom.drawerCompanyNameDisplay.textContent = companyVal;
  if (dom.drawerJobTitle)          dom.drawerJobTitle.value                = jobTitleVal;
  if (dom.drawerCompanyName)        dom.drawerCompanyName.value              = companyVal;
  dom.drawerDate.textContent = formatDisplayDate((app['Create Date'] || '').trim());
  
  const hiringTeamVal = (app['Hiring Team'] || '').trim();
  if (dom.drawerHiringTeam) {
    dom.drawerHiringTeam.value = hiringTeamVal;
    updateHiringTeamLink();
  }

  const followUpVal = (app['Follow-Up'] || '').trim();
  if (dom.drawerFollowUp) {
    dom.drawerFollowUp.value = followUpVal;
    updateFollowUpLink();
  }
  
  const score = (app['Job_Suitability'] || '').trim();
  const evaluation = (app['Job_Suitability_Evaluation'] || '').trim();
  
  const hasSuitability = !!(score || evaluation);
  if (hasSuitability) {
    if (dom.tabSuitability) {
      dom.tabSuitability.classList.remove('disabled');
      dom.tabSuitability.removeAttribute('disabled');
    }
    
    if (score) {
      dom.drawerSuitabilityScore.textContent = score;
      const scoreNum = parseInt(score, 10);
      const scoreClass = !isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5 ? `score-${scoreNum}` : '';
      
      if (dom.suitabilityScoreCircle) {
        dom.suitabilityScoreCircle.className = `suitability-score-circle ${scoreClass}`;
      }
      
      if (dom.scoreCircleFill) {
        const scorePercent = !isNaN(scoreNum) && scoreNum >= 1 && scoreNum <= 5 ? scoreNum / 5 : 0;
        dom.scoreCircleFill.style.strokeDashoffset = 251.2 * (1 - scorePercent);
      }
      
      dom.drawerSuitabilityScoreContainer.style.display = '';
    } else {
      dom.drawerSuitabilityScoreContainer.style.display = 'none';
      if (dom.scoreCircleFill) dom.scoreCircleFill.style.strokeDashoffset = 251.2;
      if (dom.suitabilityScoreCircle) dom.suitabilityScoreCircle.className = 'suitability-score-circle';
    }

    if (evaluation) {
      dom.drawerSuitabilityEval.textContent = evaluation;
      dom.sectionSuitabilityEval.classList.remove('hidden');
    } else {
      dom.sectionSuitabilityEval.classList.add('hidden');
    }
  } else {
    if (dom.tabSuitability) {
      dom.tabSuitability.classList.add('disabled');
      dom.tabSuitability.setAttribute('disabled', 'true');
    }
  }

  const comments = (app['Comments'] || '').trim();
  if (dom.drawerCommentsTextarea) {
    dom.drawerCommentsTextarea.value = comments;
  }

  if (dom.drawerStatusSelect) {
    const options = Array.from(dom.drawerStatusSelect.options);
    const matchedOption = options.find(opt => opt.value.toLowerCase() === status.toLowerCase());
    if (matchedOption) {
      dom.drawerStatusSelect.value = matchedOption.value;
    } else {
      dom.drawerStatusSelect.value = "Applied";
    }
    updateSelectColorClass(dom.drawerStatusSelect);
  }

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

  const hasInterview = !!(interviewCompany || interviewPrep);
  if (hasInterview) {
    if (dom.tabInterview) {
      dom.tabInterview.classList.remove('disabled');
      dom.tabInterview.removeAttribute('disabled');
    }

    dom.drawerInterviewCompany.innerHTML = interviewCompany ? parseMarkdown(interviewCompany) : '-';
    if (dom.btnCopyInterviewCompany) dom.btnCopyInterviewCompany.style.display = interviewCompany ? '' : 'none';

    dom.drawerInterviewPreparation.innerHTML = interviewPrep ? parseMarkdown(interviewPrep) : '-';
    if (dom.btnCopyInterviewPreparation) dom.btnCopyInterviewPreparation.style.display = interviewPrep ? '' : 'none';

    if (dom.drawerInterviewNotes) dom.drawerInterviewNotes.value = (app['Interview_Notes'] || '').trim();

    setInterviewLoadingState(false);
  } else {
    if (dom.tabInterview) {
      dom.tabInterview.classList.add('disabled');
      dom.tabInterview.setAttribute('disabled', 'true');
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

function showEl(el) {
  if (!el) return;
  el.classList.remove('tab-hidden');
  el.classList.remove('tab-exit');
  el.classList.add('tab-enter');
  
  // Force browser layout reflow to register style changes
  void el.offsetWidth;
  
  el.classList.add('tab-fade-in');
}

function hideEl(el) {
  if (!el) return;
  el.classList.remove('tab-fade-in');
  el.classList.remove('tab-enter');
  el.classList.add('tab-exit');
  
  // Wait for the exit transition duration (150ms) before hiding element
  setTimeout(() => {
    if (el.classList.contains('tab-exit')) {
      el.classList.add('tab-hidden');
      el.classList.remove('tab-exit');
    }
  }, 150);
}

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
    // Check if we need to auto-refresh data (delegated to fetchData(true) for TTL validation)
    if (targetTab === 'home' || targetTab === 'dashboard') {
      fetchData(true);
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

    // Stop landing particles when navigating away
    if (targetTab !== 'landing' && window._landingParticles) {
      window._landingParticles.stop();
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
      hideEl(dom.globalDashboardRangeContainer);

      // Start landing particle network
      if (!window._landingParticles) {
        window._landingParticles = new LandingParticles();
      }
      window._landingParticles.start();
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
      hideEl(dom.globalDashboardRangeContainer);
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
      showEl(dom.globalDashboardRangeContainer);

      if (state.rawApplications.length > 0) {
        try {
          const range = state.dashboardRange || 'yearly';
          const filtered = getFilteredDashboardApps(range);
          calculateStatistics(filtered);
          renderAllDashboardWidgets(filtered);
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
      hideEl(dom.globalDashboardRangeContainer);

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
      hideEl(dom.globalDashboardRangeContainer);
      // Lazy-load resume.css if not already loaded
      const initResumeTab = () => {
        showEl(dom.resumeSection);
        if (window._resumeApp && window._resumeApp.onTabActivated) {
          window._resumeApp.onTabActivated();
        }
      };

      if (!document.getElementById('lazy-resume-css')) {
        const link = document.createElement('link');
        link.id = 'lazy-resume-css';
        link.rel = 'stylesheet';
        link.href = 'css/resume.css?v=16';
        link.onload = initResumeTab;
        document.head.appendChild(link);
      } else {
        initResumeTab();
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
  if (dom.jobInterviewForm) {
    dom.jobInterviewForm.setAttribute('aria-busy', isLoading ? 'true' : 'false');
  }

  const elements = [
    dom.btnSubmitInterviewNotes,
    dom.btnResetInterviewNotes,
    dom.drawerInterviewNotes,
    dom.btnSubmitOverviewUpdates,
    dom.drawerStatusSelect,
    dom.drawerCommentsTextarea
  ];
  elements.forEach(el => {
    if (el) el.disabled = isLoading;
  });
}

async function submitJobInterviewForm(submitterId) {
  const form = dom.jobInterviewForm;
  if (!form) return;

  if (isInterviewSubmitting) return;

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    showToast('Please fill in all required fields correctly.', 'warning');
    return;
  }

  isInterviewSubmitting = true;
  const msg = submitterId === 'btnSubmitOverviewUpdates' ? 'Submitting updates... Please wait for feedback.' : 'Submitting your notes... Please wait for feedback.';
  showToast(msg, 'info');

  await postForm(NOTES_API_ENDPOINT, new FormData(form), {
    setLoading: (v) => setInterviewLoadingState(v),
    onSuccess: () => {
      form.classList.remove('was-validated');
      showToast('Changes submitted successfully!', 'success');
      if (state.currentApp) {
        if (submitterId === 'btnSubmitOverviewUpdates') {
          if (dom.drawerStatusSelect) {
            const newStatus = dom.drawerStatusSelect.value;
            state.currentApp['Application Status'] = newStatus;
            
          }
          if (dom.drawerCommentsTextarea) {
            state.currentApp['Comments'] = dom.drawerCommentsTextarea.value.trim();
          }
          if (dom.drawerFollowUp) {
            state.currentApp['Follow-Up'] = dom.drawerFollowUp.value.trim();
          }
          if (dom.drawerHiringTeam) {
            state.currentApp['Hiring Team'] = dom.drawerHiringTeam.value.trim();
          }
        } else {
          const notesEl = document.getElementById('drawerInterviewNotes');
          state.currentApp['Interview_Notes'] = notesEl ? notesEl.value.trim() : '';
        }
      }
      if (submitterId === 'btnSubmitOverviewUpdates') {
        fetchData(false, true);
      } else {
        setTimeout(fetchData, 3000);
      }
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
    const isActive = status !== '' && status !== 'ready' && status !== 'rejected' && status !== 'withdrawn' && status !== 'applied';
    
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

  // Create hash/signature of data to prevent redundant DOM painting
  const currentRenderHash = `${state.dataVersion}-${state.selectedCompany || ''}-${state.selectedJobTitle || ''}-${state.selectedStatus || ''}`;
  if (dom.activeInterviewsGrid.getAttribute('data-render-hash') === currentRenderHash) {
    return; // Skip re-rendering if data is identical
  }
  dom.activeInterviewsGrid.setAttribute('data-render-hash', currentRenderHash);
  dom.activeInterviewsGrid.innerHTML = '';
  
  const frag = document.createDocumentFragment();
  
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
    
    frag.appendChild(card);
  });
  dom.activeInterviewsGrid.appendChild(frag);
}

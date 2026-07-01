import { parseDate } from './Utils.js';

let cumulativeSubmissionsChartInstance = null;
let statusSplitChartInstance = null;
let suitabilityBarChartInstance = null;
let topCompaniesChartInstance = null;
let lastRenderHash = '';

/**
 * Resolves CSS design tokens in a single layout read.
 */
export function getDesignTokens() {
  const style = getComputedStyle(document.documentElement);
  return {
    primary:      style.getPropertyValue('--color-primary').trim()       || '#1a73e8',
    warning:      style.getPropertyValue('--color-warning').trim()       || '#b06000',
    error:        style.getPropertyValue('--color-error').trim()         || '#d93025',
    textSecondary:style.getPropertyValue('--color-text-secondary').trim()|| '#5f6368',
    scores: [1, 2, 3, 4, 5].map(n =>
      style.getPropertyValue(`--color-score-${n}`).trim() || '#888'
    ),
  };
}

export function initCumulativeSubmissionsChart(applications, tokens) {
  const canvasEl = document.getElementById('cumulativeSubmissionsChart');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');

  // 1. Group applications by date
  const dateMap = {};
  applications.forEach(app => {
    const dateStr = (app['Create Date'] || '').trim();
    if (!dateStr) return;
    if (!dateMap[dateStr]) dateMap[dateStr] = 0;
    dateMap[dateStr]++;
  });

  // 2. Sort dates chronologically
  const sortedDates = Object.keys(dateMap).sort((a, b) => parseDate(a) - parseDate(b));

  // 3. Prepare cumulative dataset
  let runningTotal = 0;
  const cumulativeData = sortedDates.map(date => {
    runningTotal += dateMap[date];
    return runningTotal;
  });

  // 4. Render or Update Chart
  const chartLabels = sortedDates.map(dateStr => {
    const date = parseDate(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    return `${day}-${month} (${weekdays[date.getDay()]})`;
  });

  if (cumulativeSubmissionsChartInstance) {
    cumulativeSubmissionsChartInstance.data.labels = chartLabels;
    cumulativeSubmissionsChartInstance.data.datasets[0].data = cumulativeData;
    cumulativeSubmissionsChartInstance.data.datasets[0].borderColor = tokens.primary;
    cumulativeSubmissionsChartInstance.data.datasets[0].backgroundColor = tokens.primary + '14';
    cumulativeSubmissionsChartInstance.data.datasets[0].pointBackgroundColor = tokens.primary;
    cumulativeSubmissionsChartInstance.options.plugins.tooltip.callbacks.title = (items) => sortedDates[items[0].dataIndex] || '';
    cumulativeSubmissionsChartInstance.update();
  } else {
    cumulativeSubmissionsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [{
          label: 'Total Submissions',
          data: cumulativeData,
          borderColor: tokens.primary,
          backgroundColor: tokens.primary + '14',
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointBackgroundColor: tokens.primary,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            backgroundColor: '#202124',
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: (items) => sortedDates[items[0].dataIndex] || ''
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: { stepSize: 5, precision: 0, font: { size: 11 } },
            min: 0
          }
        }
      }
    });
  }
}

export function initStatusSplitChart(applications, tokens) {
  const canvasEl = document.getElementById('statusSplitChart');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  
  const statusCounts = {};
  applications.forEach(app => {
    const status = (app['Application Status'] || '').trim();
    if (!status) return;
    
    const lower = status.toLowerCase();
    let normalized = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    if (lower.includes('interview')) {
      normalized = 'Interviewed';
    } else if (lower === 'applied') {
      normalized = 'Applied';
    } else if (lower === 'rejected') {
      normalized = 'Rejected';
    }
    
    statusCounts[normalized] = (statusCounts[normalized] || 0) + 1;
  });

  const statusColors = {
    'Ready': '#70757a',
    'Applied': tokens.primary,
    'Interviewed': tokens.warning,
    'Offered': '#12b5cb',
    'Accepted': '#1e8e3e',
    'Withdrawn': '#9aa0a6',
    'Rejected': tokens.error
  };

  const statusOrder = ['Ready', 'Applied', 'Interviewed', 'Offered', 'Accepted', 'Withdrawn', 'Rejected'];
  const activeStatuses = Object.keys(statusCounts).sort((a, b) => {
    const idxA = statusOrder.indexOf(a);
    const idxB = statusOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  const data = activeStatuses.map(status => statusCounts[status]);
  const labels = activeStatuses;
  const colors = activeStatuses.map(status => statusColors[status] || '#70757a');

  if (statusSplitChartInstance) {
    statusSplitChartInstance.data.labels = labels;
    statusSplitChartInstance.data.datasets[0].data = data;
    statusSplitChartInstance.data.datasets[0].backgroundColor = colors;
    statusSplitChartInstance.update();
  } else {
    statusSplitChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Status Split', data, backgroundColor: colors, borderRadius: 6, maxBarThickness: 45 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#202124',
            titleFont: { size: 12, weight: 'bold' },
            bodyFont: { size: 12 },
            cornerRadius: 8,
            callbacks: {
              label: (item) => {
                const total = data.reduce((a, b) => a + b, 0);
                const val = data[item.dataIndex];
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return ` ${item.label}: ${val} (${pct}%)`;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { stepSize: 5, precision: 0, font: { size: 11 } }, min: 0 }
        }
      }
    });
  }
}

export function initSuitabilityBarChart(applications, tokens) {
  const canvasEl = document.getElementById('suitabilityBarChart');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  applications.forEach(app => {
    const score = parseInt((app['Job_Suitability'] || '').trim(), 10);
    if (score >= 1 && score <= 5) counts[score]++;
  });
  
  const labels = ['Score 1', 'Score 2', 'Score 3', 'Score 4', 'Score 5'];
  const data = [counts[1], counts[2], counts[3], counts[4], counts[5]];
  
  if (suitabilityBarChartInstance) {
    suitabilityBarChartInstance.data.datasets[0].data = data;
    suitabilityBarChartInstance.data.datasets[0].backgroundColor = tokens.scores;
    suitabilityBarChartInstance.update();
  } else {
    suitabilityBarChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Applications', data, backgroundColor: tokens.scores, borderRadius: 4, maxBarThickness: 30 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#202124', titleFont: { size: 12, weight: 'bold' }, bodyFont: { size: 12 }, cornerRadius: 8 }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { stepSize: 5, precision: 0, font: { size: 11 } }, min: 0 }
        }
      }
    });
  }
}

export function initTopCompaniesChart(applications, tokens) {
  const canvasEl = document.getElementById('topCompaniesChart');
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  
  const companyCounts = {};
  applications.forEach(app => {
    const company = (app['Company Name'] || '').trim();
    if (company) companyCounts[company] = (companyCounts[company] || 0) + 1;
  });
  
  const sortedCompanies = Object.entries(companyCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = sortedCompanies.map(item => item[0]);
  const data = sortedCompanies.map(item => item[1]);
  
  const backgroundColors = sortedCompanies.map(item => {
    const company = item[0];
    const hasActiveApp = applications.some(app => {
      if ((app['Company Name'] || '').trim() !== company) return false;
      const status = (app['Application Status'] || '').trim().toLowerCase();
      return status !== 'rejected' && status !== 'withdrawn';
    });
    return hasActiveApp ? (tokens.primary + 'cc') : (tokens.textSecondary + 'cc');
  });

  const hoverBackgroundColors = sortedCompanies.map(item => {
    const company = item[0];
    const hasActiveApp = applications.some(app => {
      if ((app['Company Name'] || '').trim() !== company) return false;
      const status = (app['Application Status'] || '').trim().toLowerCase();
      return status !== 'rejected' && status !== 'withdrawn';
    });
    return hasActiveApp ? tokens.primary : tokens.textSecondary;
  });

  if (topCompaniesChartInstance) {
    topCompaniesChartInstance.data.labels = labels;
    topCompaniesChartInstance.data.datasets[0].data = data;
    topCompaniesChartInstance.data.datasets[0].backgroundColor = backgroundColors;
    topCompaniesChartInstance.data.datasets[0].hoverBackgroundColor = hoverBackgroundColors;
    topCompaniesChartInstance.update();
  } else {
    topCompaniesChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Applications', data, backgroundColor: backgroundColors, hoverBackgroundColor: hoverBackgroundColors, borderRadius: 4, maxBarThickness: 20 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#202124', titleFont: { size: 12, weight: 'bold' }, bodyFont: { size: 12 }, cornerRadius: 8 }
        },
        scales: {
          x: { grid: { color: 'rgba(0, 0, 0, 0.05)' }, ticks: { stepSize: 1, precision: 0, font: { size: 11 } }, min: 0 },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  }
}

export function renderAllDashboardWidgets(applications, force = false) {
  if (applications.length === 0) return;

  const isDark = document.documentElement.classList.contains('theme-dark');
  const currentRenderHash = `theme:${isDark}-len:${applications.length}-` + applications.map(a => `${a['Company Name'] || ''}-${a['Job Title'] || ''}-${a['Application Status'] || ''}`).join('|');
  if (!force && lastRenderHash === currentRenderHash) {
    return;
  }
  lastRenderHash = currentRenderHash;

  // Set Chart.js global font/color defaults once per render cycle
  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = 'Roboto, sans-serif';
    Chart.defaults.color = '#5f6368';
  }

  // Resolve CSS design tokens in one layout read
  const tokens = getDesignTokens();

  try {
    initCumulativeSubmissionsChart(applications, tokens);
    initStatusSplitChart(applications, tokens);
    initSuitabilityBarChart(applications, tokens);
    initTopCompaniesChart(applications, tokens);
  } catch (error) {
    console.error("Error rendering dashboard widgets:", error);
  }
}

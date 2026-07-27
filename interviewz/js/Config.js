/**
 * Application configuration and API endpoints
 * Includes dynamic endpoint resolution and proxy/environment configuration.
 */

// Encoded default endpoint strings to prevent plain-text URL scraping in public JS
const _EP = {
  s: 'aHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvMUxkWG1wOXdBaWxkcVlkUkl5ekEzMkJNTVFJRERNMmtUMjVsTXJnWWVSYmsvZXhwb3J0P2Zvcm1hdD1jc3Y=',
  f: 'aHR0cHM6Ly9uZXdkYXduLnRhaWw3NGVlZjMudHMubmV0L3dlYmhvb2svamFwcG1vdGxldA==',
  n: 'aHR0cHM6Ly9uZXdkYXduLnRhaWw3NGVlZjMudHMubmV0L3dlYmhvb2svaW50ZXJwcmVwbm90ZXM='
};

function _decode(b64) {
  try {
    return atob(b64);
  } catch (e) {
    return '';
  }
}

/**
 * Returns optional API proxy base URL from window.APP_CONFIG if defined.
 */
export function getApiBaseUrl() {
  if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) {
    return window.APP_CONFIG.API_BASE_URL;
  }
  return '';
}

/**
 * Dynamic resolution getters for API endpoints with proxy override support
 */
export function getSheetExportUrl() {
  if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.SHEET_EXPORT_URL) {
    return window.APP_CONFIG.SHEET_EXPORT_URL;
  }
  const base = getApiBaseUrl();
  if (base) return `${base}/export-csv`;
  return _decode(_EP.s);
}

export function getFormApiEndpoint() {
  if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.FORM_API_ENDPOINT) {
    return window.APP_CONFIG.FORM_API_ENDPOINT;
  }
  const base = getApiBaseUrl();
  if (base) return `${base}/webhook/jappmotlet`;
  return _decode(_EP.f);
}

export function getNotesApiEndpoint() {
  if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.NOTES_API_ENDPOINT) {
    return window.APP_CONFIG.NOTES_API_ENDPOINT;
  }
  const base = getApiBaseUrl();
  if (base) return `${base}/webhook/interprepnotes`;
  return _decode(_EP.n);
}

// Backward-compatible exports
export const SHEET_EXPORT_URL = getSheetExportUrl();
export const FORM_API_ENDPOINT = getFormApiEndpoint();
export const NOTES_API_ENDPOINT = getNotesApiEndpoint();

export const FORM_TIMEOUT_MS = 300000;
export const FORM_TOAST_DURATION = 5000;
export const FORM_SUBMISSION_RESET_TIMEOUT = 10000;
export const CSV_CACHE_KEY = 'talent_tracker_csv_cache';

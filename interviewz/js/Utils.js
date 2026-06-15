import { FORM_TIMEOUT_MS } from './Config.js';

/**
 * Utility functions for OpportunityTracker
 */

/**
 * Escapes HTML to prevent XSS injection
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Date Parser helper (DD-MM-YYYY)
 */
export function parseDate(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const d = new Date(parts[2], parts[1] - 1, parts[0]);
    if (!isNaN(d.getTime())) return d;
  }
  const parsed = Date.parse(dateStr);
  if (isNaN(parsed)) {
    console.warn(`[OpportunityTracker] Could not parse date: "${dateStr}"`);
    return new Date(0);
  }
  return new Date(parsed);
}

/**
 * Formats a DD-MM-YYYY date into DD-MM-YYYY (We) format
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = parseDate(dateStr);
  if (date.getTime() === 0) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  return `${day}-${month}-${year} (${weekdays[date.getDay()]})`;
}

/**
 * Shared form submission utility.
 * Handles AbortController timeout, fetch, JSON result check, and error routing
 */
export async function postForm(url, formData, { setLoading, onSuccess, onError }) {
  setLoading(true);
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), FORM_TIMEOUT_MS);
  try {
    const response = await fetch(url, { method: 'POST', body: formData, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Server returned ${response.status}: ${errText}`);
    }
    const result = await response.json();
    if (result.ok === true) {
      onSuccess(result);
    } else {
      throw new Error(result.message || 'The submission was not successful. Please try again.');
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[postForm] error:', err);
    onError(err);
  } finally {
    setLoading(false);
  }
}

/**
 * Extract the last comment line from comments block
 */
export function getLastComment(commentsStr) {
  if (!commentsStr) return 'No comments available.';
  const lines = commentsStr.split('\n')
    .map(line => line.trim())
    .filter(line => line !== '');
  if (lines.length === 0) return 'No comments available.';
  return lines[lines.length - 1];
}

/**
 * Parse a comment line with custom [date] prefix into HTML structure
 */
export function parseCommentLine(line) {
  const match = line.match(/^\[(.*?)\]\s*(.*)$/);
  if (match) {
    return `<span class="comment-date">[${escapeHtml(match[1])}]</span> <span class="comment-text">${escapeHtml(match[2])}</span>`;
  }
  return escapeHtml(line);
}

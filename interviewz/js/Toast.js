import { escapeHtml } from './Utils.js';

/**
 * Dynamic Toast Alert Utility
 */
let toastContainerEl = null;

export function showToast(message, type = 'success') {
  if (!toastContainerEl || !toastContainerEl.parentNode) {
    toastContainerEl = document.getElementById('toastContainer');
    if (!toastContainerEl) {
      toastContainerEl = document.createElement('div');
      toastContainerEl.id = 'toastContainer';
      toastContainerEl.className = 'toast-container';
      document.body.appendChild(toastContainerEl);
    }
  }
  
  const toast = document.createElement('div');
  toast.className = `toast-item ${type}`;
  toast.innerHTML = `<span class="toast-message">${escapeHtml(message)}</span>`;
  toastContainerEl.appendChild(toast);
  
  // Trigger transition
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Fade out and remove
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
    // Fallback if transitionend is not supported or doesn't fire
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 400);
  }, 4000);
}

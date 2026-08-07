# Interviewz Analysis Report: Usability and Performance Improvements

## Executive Summary

Interviewz is a hand-built static Single Page Application (SPA) designed for tracking job applications. It provides:

- An Applications Kanban board backed by Google Sheets CSV data
- Dashboard metrics and Chart.js visualizations
- A New Application submission form routed through an n8n webhook
- An Interview Notes and status update flow routed through a separate n8n webhook
- LocalStorage caching and form draft persistence
- Responsive styling with light and dark theme toggles

While the core functionality is clear and functional as a prototype, detailed inspection of the codebase reveals several usability, interaction, performance, and architecture risks.

### Key Risk Areas

1. **Initial Rendering Overhead**: The landing page performs complete dataset parsing, Kanban board creation, statistics calculations, and Chart.js instantiation before the user ever navigates to Applications or Dashboard views.
2. **Broken Cache Validation**: Encrypted LocalStorage cached CSV data is compared directly against unencrypted remote CSV text, causing the "cache matches remote" check to fail and forcing a re-parse on every refresh.
3. **Redundant Network Syncs**: Opening the Applications view always forces a full CSV fetch from Google Sheets, ignoring cache freshness.
4. **Missing UI Error Handling Elements**: The error handling code targets an element `#noResults` which does not exist in `index.html`, leaving users with an incomplete UI during network failures.
5. **Chart Off-Screen Sizing**: Chart.js charts are instantiated while their container element is set to `display: none`, risking incorrect canvas sizing or blank chart renders when switching to the Dashboard tab.
6. **Interaction & Accessibility Barriers**: The Kanban board relies on HTML drag-and-drop without keyboard or accessible touch alternatives. In addition, the details drawer lacks modal dialog semantics (`role="dialog"`, focus trap, focus restoration).
7. **CI/Build Misconfiguration**: The repository lacks an `interviewz` build pipeline, and GitHub Actions workflows currently build `artz` instead of `interviewz`.

---

## Architecture Baseline

### Overview

```text
Browser SPA (index.html, app.js, styles.css)
  │
  ├── Google Sheets CSV Export (Primary Read DB)
  ├── n8n Webhook: Application Submission
  ├── n8n Webhook: Notes & Status Updates
  ├── Google Drive: Company & Application Documents
  └── LocalStorage: CSV Cache, Theme Preference, Dashboard Range, Drafts
```

### File & Asset Inventory

- **HTML**: `interviewz/index.html` (~62 KB)
- **CSS**: `interviewz/css/styles.css` (~112 KB / 4,775 lines)
- **Main Script**: `interviewz/js/app.js` (~77 KB / 2,115 lines)
- **Chart Logic**: `interviewz/js/Charts.js` (~15 KB / 424 lines)
- **Utilities**: `interviewz/js/Utils.js` (~13 KB / 347 lines)
- **Form Module**: `interviewz/js/FormApp.js` (~9 KB / 274 lines)
- **Config & State**: `interviewz/js/Config.js`, `interviewz/js/State.js`
- **Documentation**: Architecture flow diagrams (`n8nProcessFlows.docx`, `TalentTracker.pdf`)

---

## Usability Findings & Recommendations

### 1. Initial Content Layout Flash

- **Location**: `interviewz/index.html:359-735`, `interviewz/js/app.js:1943-1958`
- **Issue**: Non-landing sections (hero banner, filters, Kanban board) lack initial `tab-hidden` CSS classes in HTML markup and are hidden only via JavaScript during `switchTab('landing')`. On slow script evaluations, layout jumping or UI flash can occur.
- **Recommendation**: Default non-landing containers to hidden in HTML markup. Bind event listeners dynamically rather than relying on inline HTML `onclick` handlers referencing global window functions.

### 2. Ambiguous Loading, Empty, and Error States

- **Location**: `interviewz/js/app.js:183-185`, `interviewz/js/app.js:713-737`, `interviewz/js/app.js:1254-1260`
- **Issue**: Columns render `No applications` even while a remote fetch is in progress. Additionally, error handlers reference `#noResults`, which is missing from `index.html`.
- **Recommendation**: Create explicit UI states: `Loading applications...`, `No applications match filters`, `Network error / Offline mode`. Add a dedicated retry component directly in the board view.

### 3. Misleading Dashboard Range Labels

- **Location**: `interviewz/index.html:383-397`, `interviewz/index.html:764-770`, `interviewz/js/app.js:911-935`
- **Issue**: Range filters switch metrics between "weekly" and "yearly" (YTD), but card headings still display fixed labels like `Total Applications` and `Status Split Today`.
- **Recommendation**: Dynamically append the current active range to chart and metric headers (e.g., `Status Split (Weekly)` vs. `Status Split (Year to Date)`).

### 4. Unknown Statuses Mapped to "Applied"

- **Location**: `interviewz/js/app.js:1224-1233`, `interviewz/js/app.js:1817-1825`
- **Issue**: Unrecognized application status values default silently to `Applied` in both Kanban rendering and the details drawer.
- **Recommendation**: Preserve raw status values. Display unknown statuses in an `Other` column or dynamically populate the dropdown to avoid accidental data corruption on save.

### 5. Inaccessible Kanban Interaction

- **Location**: `interviewz/js/app.js:1360-1414`
- **Issue**: Status changes rely exclusively on HTML native drag-and-drop, which is inaccessible to keyboard users and unreliable on mobile/touch browsers.
- **Recommendation**: Add a visible "Move status" dropdown or context menu on each Kanban card to allow explicit keyboard and touch navigation.

### 6. Desktop-Only Kanban Horizontal Layout

- **Location**: `interviewz/css/styles.css:4532-4539`
- **Issue**: The board enforces 5 columns with `minmax(295px, 1fr)`, causing wide horizontal scrolling on narrow screens without scroll indicators.
- **Recommendation**: Introduce a single-column mobile view with status tab toggles or a compact list layout on small screens.

### 7. Unconstrained View Details Drawer Width

- **Location**: `interviewz/css/styles.css:1427-1445`
- **Issue**: The details drawer occupies `100vw` on desktop screen sizes, obscuring all underlying workspace context.
- **Recommendation**: Cap maximum drawer width on desktop (e.g., `max-width: 800px`), retaining `100vw` on mobile breakpoints.

### 8. Incomplete Modal Semantics for Detail Drawer

- **Location**: `interviewz/js/app.js:1698-1866`, `interviewz/index.html:935-978`
- **Issue**: Opening the drawer disables body scrolling, but does not manage focus, trap keyboard navigation, or set `role="dialog"` and `aria-modal="true"`.
- **Recommendation**: Add standard dialog ARIA attributes, trap focus while active, focus the close button upon opening, and restore focus to the originating card trigger when closed.

### 9. Obscure Action Button Controls

- **Location**: `interviewz/index.html:944-960`, `interviewz/js/app.js:1554-1562`
- **Issue**: Detail drawer save buttons are icon-only checkmarks located in the drawer header that change depending on tab selection, making submission controls easy to miss.
- **Recommendation**: Add visible text labels (`Save Overview`, `Save Notes`) or move save actions directly inside their respective tab panels.

### 10. Unintended Enter-Key Submissions

- **Location**: `interviewz/js/app.js:506-519`, `interviewz/js/app.js:2068-2070`
- **Issue**: Submitting the form via the Enter key without an explicit `event.submitter` defaults to submitting interview notes instead of overview updates.
- **Recommendation**: Inspect the active drawer tab to determine submission intent when `event.submitter` is undefined.

---

## Performance Findings & Recommendations

### 1. Eager Initialization on Landing Page

- **Location**: `interviewz/js/app.js:262-273`, `interviewz/js/app.js:844-908`
- **Issue**: App startup triggers full CSV cache reading/decryption, Google Sheets fetching, state filtering, full Kanban DOM generation, statistics compilation, and 4 Chart.js chart initializations while on the Landing tab.
- **Recommendation**: Defer Kanban board rendering and chart generation until the user switches to the Applications or Dashboard tab.

### 2. Broken CSV Cache Validation Logic

- **Location**: `interviewz/js/app.js:681-690`, `interviewz/js/app.js:754-759`
- **Issue**: `parsedCached.csv` contains the encrypted Base64 string, but line 689 compares it directly against `csvText` (the raw plaintext CSV response). The match always evaluates to `false`, invalidating the cache match optimization.
- **Recommendation**: Store an unencrypted hash (or raw length + checksum) of the plaintext CSV in the cache object and compare hashes upon fetching.

### 3. Forced Data Refreshing

- **Location**: `interviewz/js/app.js:1907-1914`, `interviewz/js/app.js:2098-2100`
- **Issue**: Switching to the Applications tab or completing an overview submission forces a full spreadsheet re-download, ignoring recent sync timestamps.
- **Recommendation**: Use conditional HTTP headers (`If-None-Match` / `ETag` or `If-Modified-Since`) or rely on a minimum cache TTL before issuing new fetch requests.

### 4. Unindexed DOM Sorting and Full Re-renders

- **Location**: `interviewz/js/app.js:1113-1187`, `interviewz/js/app.js:1242-1251`, `interviewz/js/app.js:1448-1461`
- **Issue**: Filter changes tear down and recreate every card DOM node. Sorting re-parses date strings repeatedly instead of referencing pre-parsed `_parsedDate` timestamps. Drag-and-drop operations perform O(N²) array lookups.
- **Recommendation**: Reuse `app._parsedDate` during sorting. Use a key-indexed map for card lookups and mutate only modified columns during drag-and-drop or status updates.

### 5. Unthrottled Hero Canvas Animation

- **Location**: `interviewz/js/app.js:62-75`, `interviewz/js/app.js:114-164`
- **Issue**: The landing canvas animation evaluates up to 1,770 particle pair distance checks per frame without checking visibility or system reduced-motion preferences.
- **Recommendation**: Pause the animation frame loop when the landing tab is hidden or when `prefers-reduced-motion: reduce` is detected. Cap canvas backing store scaling on high-DPR screens.

### 6. Unbundled Static Delivery

- **Location**: `interviewz/index.html:23-32`, `interviewz/index.html:1183`
- **Issue**: 9 JavaScript ES modules and multiple stylesheets/fonts are requested as individual unminified files directly from the browser.
- **Recommendation**: Introduce a lightweight production bundler (Vite or esbuild) to minify assets, tree-shake dependencies, and lazy-load non-critical modules (like Chart.js or FormApp).

### 7. Large Unscaled Screenshot Images

- **Location**: `interviewz/index.html:211-289`, `interviewz/assets/`
- **Issue**: Showcase screenshots are delivered at full 2800×1800 resolution (~50 KB to ~115 KB each) and lack `srcset`, `sizes`, `width`, or `height` attributes, leading to memory overhead and potential Cumulative Layout Shift (CLS).
- **Recommendation**: Provide responsive image variants (`srcset`) and add explicit width/height dimensions.

---

## Testing & Observability Gaps

1. **Test Automation**: No automated unit, integration, or end-to-end tests exist for `interviewz`.
2. **Performance Telemetry**: No Web Vitals, `PerformanceObserver`, or custom `performance.mark` markers are implemented.
3. **Error Reporting**: Uncaught network errors or invalid JSON payloads log only to the browser console without centralized monitoring.

---

## Prioritized Implementation Roadmap

| Phase | Category | Action Items | Estimated Effort |
| :--- | :--- | :--- | :--- |
| **Phase 1** | **Correctness & Critical Fixes** | - Fix CSV cache comparison bug in `app.js`<br>- Add missing `#noResults` error DOM container<br>- Default non-landing view markup to hidden<br>- Add drawer focus trap and modal accessibility (`role="dialog"`) | 1–2 Days |
| **Phase 2** | **UX & Interaction** | - Add accessible keyboard/touch status shift controls<br>- Expose global text search and sort controls<br>- Add dynamic active range indicators to dashboard headers<br>- Implement mobile-friendly single-column layout | 2–3 Days |
| **Phase 3** | **Performance & Bundling** | - Defer chart initialization until Dashboard tab is active<br>- Pause particle canvas loop when tab is backgrounded<br>- Add Vite build script to bundle/minify static JS & CSS<br>- Add responsive `srcset` and explicit image dimensions | 2–3 Days |
| **Phase 4** | **Observability & Testing** | - Add Playwright E2E suite covering main user flows<br>- Add `performance.mark` timing instruments around CSV parsing and Kanban rendering<br>- Configure CI workflow for `interviewz` | 2–3 Days |

---

*Report exported to `interviewz/documentation/interviewz-usability-performance-report.md` on August 6, 2026.*

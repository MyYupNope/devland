# Graph Report - .  (2026-07-30)

## Corpus Check
- 38 files · ~56,313 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 228 nodes · 455 edges · 21 communities (11 shown, 10 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Interviewz Application Logic & Filters
- Artz Particle Animation & Controls
- Resume Interactive Canvas & Animations
- Interviewz Form & API Configuration
- Artz Dependencies & Build Tools
- Interviewz Form Application Handler
- Interviewz UI Screenshots & Media Assets
- Interviewz Faceted Select Component
- Interviewz Analytics & Charts Dashboard
- Interviewz Landing Background Particles
- Root Multi-App Deployment Script
- Interviewz Package & Deployment Config
- Artz Application & GitHub Actions Workflow
- Graphify Knowledge Graph Configuration
- Workspace Rules & Conventions
- Local Testing Environment Configuration
- Interviewz Hero Background Media
- Interviewz Profile Image
- Interviewz Contact Image Asset

## God Nodes (most connected - your core abstractions)
1. `ResumeApp` - 26 edges
2. `init()` - 19 edges
3. `setupEventListeners()` - 18 edges
4. `FormApp` - 15 edges
5. `showToast()` - 13 edges
6. `setupUI()` - 12 edges
7. `FacetedSelect` - 12 edges
8. `fetchData()` - 11 edges
9. `openDetailsDrawer()` - 11 edges
10. `renderAllDashboardWidgets()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Rodrigo Matias Original CV (Resume)` --semantically_similar_to--> `Rodrigo Matias Original CV (Interviewz)`  [INFERRED] [semantically similar]
  resume/assets/RodrigoMatias_CV_2026_EN_Original.md → interviewz/introduction/RodrigoMatias_CV_2026_EN_Original.md
- `Interviewz Avatar Image` --semantically_similar_to--> `Resume Avatar Image`  [INFERRED] [semantically similar]
  interviewz/assets/avatar.png → resume/assets/avatar.png
- `Interviewz Favicon` --semantically_similar_to--> `Resume Favicon`  [INFERRED] [semantically similar]
  interviewz/assets/favicon.png → resume/assets/favicon.png
- `TalentTracker Documentation` --conceptually_related_to--> `OpportunityTracker Dashboard`  [INFERRED]
  interviewz/documentation/TalentTracker.pdf → interviewz/index.html
- `Artz Build Step` --references--> `Kinetic Particle Sculpture App`  [INFERRED]
  .github/workflows/deploy.yml → artz/index.html

## Import Cycles
- None detected.

## Communities (21 total, 10 thin omitted)

### Community 0 - "Interviewz Application Logic & Filters"
Cohesion: 0.12
Nodes (37): calculateStatistics(), renderSuitabilityEvaluation(), getColKeyForStatus(), updateColumnEmptyState(), initDomCache(), updateHiringTeamLink(), closeDetailsDrawer(), fetchData() (+29 more)

### Community 1 - "Artz Particle Animation & Controls"
Cohesion: 0.12
Nodes (37): onTouchMove(), render, uniforms, _dir, selectTheme(), showToast(), triggerExplosion(), CONFIG (+29 more)

### Community 3 - "Interviewz Form & API Configuration"
Cohesion: 0.17
Nodes (19): getNotesApiEndpoint(), decryptCacheData(), escapeHtml(), postForm(), getCsrfToken(), sanitizeHtml(), FORM_TIMEOUT_MS, CSV_CACHE_KEY (+11 more)

### Community 4 - "Artz Dependencies & Build Tools"
Cohesion: 0.11
Nodes (17): preview, private, devDependencies, name, gh-pages, vite, three, scripts (+9 more)

### Community 6 - "Interviewz UI Screenshots & Media Assets"
Cohesion: 0.17
Nodes (13): Interviewz Dashboard Screenshot, Interviewz New Application Screenshot, TalentTracker Documentation, Interviewz Resume Screenshot, Rodrigo Matias Original CV (Resume), Rodrigo Matias Original CV (Interviewz), OpportunityTracker Dashboard, Resume Favicon (+5 more)

### Community 8 - "Interviewz Analytics & Charts Dashboard"
Cohesion: 0.39
Nodes (7): initCumulativeSubmissionsChart(), initTopCompaniesChart(), initSuitabilityBarChart(), state, initStatusSplitChart(), renderAllDashboardWidgets(), getDesignTokens()

### Community 10 - "Root Multi-App Deployment Script"
Cohesion: 0.33
Nodes (5): tempDir, fs, srcDir, path, { execSync }

### Community 11 - "Interviewz Package & Deployment Config"
Cohesion: 0.40
Nodes (4): scripts, version, name, deploy-interviewz

### Community 12 - "Artz Application & GitHub Actions Workflow"
Cohesion: 0.50
Nodes (4): Kinetic Particle Sculpture App, Artz Favicon, GitHub Pages Deploy Workflow, Artz Build Step

## Knowledge Gaps
- **46 isolated node(s):** `CONFIG`, `state`, `physics`, `interaction`, `uniforms` (+41 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FacetedSelect` connect `Interviewz Faceted Select Component` to `Interviewz Application Logic & Filters`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `FormApp` connect `Interviewz Form Application Handler` to `Interviewz Application Logic & Filters`, `Interviewz Form & API Configuration`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `LandingParticles` connect `Interviewz Landing Background Particles` to `Interviewz Application Logic & Filters`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `init()` (e.g. with `onPointerDown()` and `onPointerUp()`) actually correct?**
  _`init()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `setupEventListeners()` (e.g. with `closeDetailsDrawer()` and `updateFollowUpLink()`) actually correct?**
  _`setupEventListeners()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CONFIG`, `state`, `physics` to the rest of the system?**
  _46 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Interviewz Application Logic & Filters` be split into smaller, more focused modules?**
  _Cohesion score 0.12051282051282051 - nodes in this community are weakly interconnected._
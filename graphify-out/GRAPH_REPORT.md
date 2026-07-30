# Graph Report - devland  (2026-07-30)

## Corpus Check
- 21 files · ~56,389 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 229 nodes · 456 edges · 21 communities (11 shown, 10 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d68b6e1a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- main.js
- ResumeApp
- Utils.js
- artz/package.json
- FormApp
- OpportunityTracker Dashboard
- FacetedSelect
- Charts.js
- LandingParticles
- deploy.js
- package.json
- Kinetic Particle Sculpture App
- Graphify Knowledge Graph Rule
- Workspace Custom Rules
- Local Testing Environment Rule
- Interviewz Hero Background Image
- Interviewz Introduction Photo
- Interviewz Introduction WhatsApp Image

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

### Community 0 - "app.js"
Cohesion: 0.11
Nodes (39): applyFilters(), CACHE_KEY_CSV(), calculateStatistics(), closeDetailsDrawer(), copyElementHtml(), dom, fetchData(), getColKeyForStatus() (+31 more)

### Community 1 - "main.js"
Cohesion: 0.12
Nodes (37): animate(), announceToScreenReader(), applyActiveOrRandomPreset(), applyPresetExplosion(), clearActivePresets(), CONFIG, _dir, ensureFontLoaded() (+29 more)

### Community 3 - "Utils.js"
Cohesion: 0.18
Nodes (17): CSV_CACHE_KEY, _decode(), _EP, FORM_SUBMISSION_RESET_TIMEOUT, FORM_TIMEOUT_MS, getApiBaseUrl(), getFormApiEndpoint(), getNotesApiEndpoint() (+9 more)

### Community 4 - "artz/package.json"
Cohesion: 0.11
Nodes (17): dependencies, three, devDependencies, gh-pages, vite, name, private, scripts (+9 more)

### Community 6 - "OpportunityTracker Dashboard"
Cohesion: 0.17
Nodes (13): Interviewz Avatar Image, Interviewz Favicon, Interviewz Applications Screenshot, Interviewz Dashboard Screenshot, Interviewz New Application Screenshot, Interviewz Resume Screenshot, TalentTracker Documentation, OpportunityTracker Dashboard (+5 more)

### Community 8 - "Charts.js"
Cohesion: 0.39
Nodes (7): getDesignTokens(), initCumulativeSubmissionsChart(), initStatusSplitChart(), initSuitabilityBarChart(), initTopCompaniesChart(), renderAllDashboardWidgets(), state

### Community 10 - "deploy.js"
Cohesion: 0.33
Nodes (5): { execSync }, fs, path, srcDir, tempDir

### Community 11 - "package.json"
Cohesion: 0.33
Nodes (5): name, scripts, deploy, deploy-interviewz, version

### Community 12 - "Kinetic Particle Sculpture App"
Cohesion: 0.50
Nodes (4): Kinetic Particle Sculpture App, Artz Favicon, Artz Build Step, GitHub Pages Deploy Workflow

## Knowledge Gaps
- **47 isolated node(s):** `CONFIG`, `state`, `physics`, `interaction`, `uniforms` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FacetedSelect` connect `FacetedSelect` to `app.js`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `FormApp` connect `FormApp` to `app.js`, `Utils.js`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `LandingParticles` connect `LandingParticles` to `app.js`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `init()` (e.g. with `onPointerDown()` and `onPointerUp()`) actually correct?**
  _`init()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `setupEventListeners()` (e.g. with `closeDetailsDrawer()` and `updateFollowUpLink()`) actually correct?**
  _`setupEventListeners()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `CONFIG`, `state`, `physics` to the rest of the system?**
  _47 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.11382113821138211 - nodes in this community are weakly interconnected._
# Workspace Custom Rules

- **Git Commits & Live Deployment ("commit")**: Never commit or push code until the user has manually tested and explicitly approved the changes. Whenever the user requests a **"commit"** (or deploy), ALWAYS automatically perform both actions end-to-end:
  1. Commit and push all changes to the source repository (`git add . && git commit -m "..." && git push origin main`).
  2. Run `npm run deploy` to build and deploy the changes to the live site (`MyYupNope.github.io`).
- **Local Testing Environment**: Always automatically launch a local test environment (server) after applying any code changes, so that the user can manually evaluate the changes before approval.
- **Strict Workspace Boundary**: All tool executions, terminal commands, file reads, edits, searches, and validations MUST operate strictly within the root directory of this workspace (`c:\devland`). Never inspect, search, modify, or execute commands in external directories outside this project root.



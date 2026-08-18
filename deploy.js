const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isDryRun = process.argv.includes('--dry-run');
const args = process.argv.slice(2).filter(arg => arg !== '--dry-run');
const commitMessage = args.join(' ') || 'Update resume and artz projects';

const targetRepo = 'https://github.com/MyYupNope/MyYupNope.github.io.git';
const tempDir = path.join(__dirname, 'temp-deploy-github-io');
const srcDir = path.join(__dirname, 'interviewz');

const EXCLUDED_DIRS = new Set(['documentation', 'introduction', '.git', '.system_generated', 'node_modules']);

function copyDirFilter(src) {
  const base = path.basename(src);
  return !EXCLUDED_DIRS.has(base);
}

try {
  if (isDryRun) {
    console.log('=== DRY RUN MODE ACTIVATED === (No changes will be pushed)');
  }

  // 1. Clean up temp folder if it exists
  if (fs.existsSync(tempDir)) {
    console.log('Cleaning up old temp directory...');
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // 2. Clone repo
  console.log('1. Cloning target repository...');
  execSync(`git clone ${targetRepo} "${tempDir}"`, { stdio: 'inherit' });

  // 3. Sync interviewz files (or remove from live deployment if deleted locally)
  const destDir = path.join(tempDir, 'interviewz');
  if (fs.existsSync(srcDir)) {
    console.log('2. Copying interviewz files (excluding documentation & introduction)...');
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true, filter: copyDirFilter });
  } else if (fs.existsSync(destDir)) {
    console.log('2. Removing deleted interviewz folder from live deployment...');
    fs.rmSync(destDir, { recursive: true, force: true });
  }

  // 3b. Copy resume files
  const resumeSrcDir = path.join(__dirname, 'resume');
  const resumeDestDir = path.join(tempDir, 'resume');
  if (fs.existsSync(resumeSrcDir)) {
    console.log('   Copying resume files...');
    if (fs.existsSync(resumeDestDir)) {
      fs.rmSync(resumeDestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(resumeDestDir, { recursive: true });
    fs.cpSync(resumeSrcDir, resumeDestDir, { recursive: true, filter: copyDirFilter });
  }

  // 3c. Sync artz files (or remove from live deployment if deleted locally)
  const artzDir = path.join(__dirname, 'artz');
  const artzDestDir = path.join(tempDir, 'artz');
  if (fs.existsSync(artzDir)) {
    console.log('   Building and copying artz files...');
    execSync('npm run build', { cwd: artzDir, stdio: 'inherit' });
    const artzDistDir = path.join(artzDir, 'dist');
    if (fs.existsSync(artzDistDir)) {
      if (fs.existsSync(artzDestDir)) {
        fs.rmSync(artzDestDir, { recursive: true, force: true });
      }
      fs.mkdirSync(artzDestDir, { recursive: true });
      fs.cpSync(artzDistDir, artzDestDir, { recursive: true, filter: copyDirFilter });
    }
  } else if (fs.existsSync(artzDestDir)) {
    console.log('   Removing deleted artz folder from live deployment...');
    fs.rmSync(artzDestDir, { recursive: true, force: true });
  }

  // 4. Commit and Push
  console.log('3. Staging and checking changes...');
  execSync('git add -A', { cwd: tempDir, stdio: 'inherit' });
  const status = execSync('git status --porcelain', { cwd: tempDir }).toString().trim();
  if (status) {
    console.log('Changes detected in target repo:\n' + status);
    if (isDryRun) {
      console.log('[DRY-RUN] Would commit with message: "' + commitMessage + '"');
      console.log('[DRY-RUN] Would push to GitHub origin master');
    } else {
      console.log('Committing changes...');
      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: tempDir, stdio: 'inherit' });

      console.log('4. Pushing to GitHub...');
      execSync('git push origin master', { cwd: tempDir, stdio: 'inherit' });
    }
  } else {
    console.log('No changes detected in target repo. Skipping commit and push.');
  }

  // 5. Clean up
  console.log('5. Cleaning up...');
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log(isDryRun ? 'Done! Dry run completed successfully.' : 'Done! Deployment successful.');
} catch (error) {
  console.error('Deployment failed:', error.message);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  process.exit(1);
}

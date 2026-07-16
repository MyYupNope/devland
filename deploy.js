const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targetRepo = 'https://github.com/MyYupNope/MyYupNope.github.io.git';
const tempDir = path.join(__dirname, 'temp-deploy-github-io');
const srcDir = path.join(__dirname, 'interviewz');

const commitMessage = process.argv.slice(2).join(' ') || 'Update interviewz and resume projects';

try {
  // 1. Clean up temp folder if it exists
  if (fs.existsSync(tempDir)) {
    console.log('Cleaning up old temp directory...');
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // 2. Clone repo
  console.log('1. Cloning target repository...');
  execSync(`git clone ${targetRepo} "${tempDir}"`, { stdio: 'inherit' });

  // 3. Copy interviewz files
  console.log('2. Copying interviewz files...');
  const destDir = path.join(tempDir, 'interviewz');
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true });

  // 3b. Copy resume files
  const resumeSrcDir = path.join(__dirname, 'resume');
  const resumeDestDir = path.join(tempDir, 'resume');
  if (fs.existsSync(resumeSrcDir)) {
    console.log('   Copying resume files...');
    if (fs.existsSync(resumeDestDir)) {
      fs.rmSync(resumeDestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(resumeDestDir, { recursive: true });
    fs.cpSync(resumeSrcDir, resumeDestDir, { recursive: true });
  }

  // 4. Commit and Push
  const status = execSync('git status --porcelain', { cwd: tempDir }).toString().trim();
  if (status) {
    console.log('3. Committing changes...');
    execSync('git add -A', { cwd: tempDir, stdio: 'inherit' });
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, { cwd: tempDir, stdio: 'inherit' });

    console.log('4. Pushing to GitHub...');
    execSync('git push origin master', { cwd: tempDir, stdio: 'inherit' });
  } else {
    console.log('No changes detected in repo. Skipping commit and push.');
  }

  // 5. Clean up
  console.log('5. Cleaning up...');
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('Done! Deployment successful.');
} catch (error) {
  console.error('Deployment failed:', error.message);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  process.exit(1);
}

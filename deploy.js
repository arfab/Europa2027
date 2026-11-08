const { execSync } = require('child_process');
const https = require('https');

function getGitHubToken() {
  const output = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf-8'
  });
  const match = output.match(/password=([^\r\n]+)/);
  if (!match) throw new Error('Could not get token from git credential manager');
  return match[1].trim();
}

function githubRequest(token, method, path, data) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'User-Agent': 'Antigravity-Agent',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body, raw: body });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  const token = getGitHubToken();
  console.log('Got GitHub token for arfab.');

  // 1. Create Repo if not exists
  console.log('Checking repository arfab/Europa2027...');
  let repoCheck = await githubRequest(token, 'GET', '/repos/arfab/Europa2027');
  if (repoCheck.status === 404) {
    console.log('Creating repository arfab/Europa2027...');
    const createRes = await githubRequest(token, 'POST', '/user/repos', {
      name: 'Europa2027',
      description: 'Planificación de viaje en pareja a Italia y Grecia en 2027',
      private: false,
      auto_init: false
    });
    if (createRes.status !== 201) {
      throw new Error(`Failed to create repository: ${createRes.status} ${createRes.raw}`);
    }
    console.log('Repository created successfully:', createRes.data.html_url);
  } else {
    console.log('Repository already exists:', repoCheck.data.html_url);
  }

  // 2. Git init, commit, push
  const cwd = 'C:\\Users\\arfab\\.gemini\\antigravity\\scratch\\Europa2027';
  console.log('Initializing git repository in', cwd);
  execSync('git init -b main', { cwd, stdio: 'inherit' });
  execSync('git config user.name "arfab"', { cwd, stdio: 'inherit' });
  execSync('git config user.email "arielfabian@gmail.com"', { cwd, stdio: 'inherit' });
  execSync('git add .', { cwd, stdio: 'inherit' });
  try {
    execSync('git commit -m "Initial commit: Landing page planificación Italia y Grecia 2027"', { cwd, stdio: 'inherit' });
  } catch (e) {
    console.log('Commit already made or no changes');
  }

  const remoteUrl = `https://${token}@github.com/arfab/Europa2027.git`;
  try {
    execSync('git remote remove origin', { cwd, stdio: 'ignore' });
  } catch (e) {}
  execSync(`git remote add origin ${remoteUrl}`, { cwd, stdio: 'inherit' });

  console.log('Pushing to main branch...');
  execSync('git push -u origin main --force', { cwd, stdio: 'inherit' });
  console.log('Pushed successfully!');

  // Reset remote URL to clean URL so token is not saved in config
  execSync('git remote set-url origin https://github.com/arfab/Europa2027.git', { cwd, stdio: 'inherit' });

  // 3. Enable GitHub Pages
  console.log('Enabling GitHub Pages...');
  const pagesRes = await githubRequest(token, 'POST', '/repos/arfab/Europa2027/pages', {
    source: {
      branch: 'main',
      path: '/'
    }
  });

  if (pagesRes.status === 201) {
    console.log('GitHub Pages enabled successfully! URL:', pagesRes.data.html_url);
  } else if (pagesRes.status === 409) {
    console.log('GitHub Pages already enabled or being built.');
  } else {
    console.log('GitHub Pages status:', pagesRes.status, pagesRes.raw);
  }

  console.log('DONE!');
}

run().catch(err => {
  console.error('Execution failed:', err);
  process.exit(1);
});

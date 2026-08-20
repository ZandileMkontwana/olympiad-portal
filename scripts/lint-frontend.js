const { execSync } = require('child_process');
const path = require('path');

const frontendDir = path.resolve(__dirname, '..', 'frontend');
const files = process.argv.slice(2).map((f) => path.relative(frontendDir, f));
const quoted = files.map((f) => `"${f}"`).join(' ');

execSync(`npx eslint --fix ${quoted}`, { cwd: frontendDir, stdio: 'inherit' });
execSync(`npx prettier --config .prettierrc --write ${quoted}`, { cwd: frontendDir, stdio: 'inherit' });
const path = require('path');

module.exports = {
  'backend/**/*.js': (filenames) => {
    const files = filenames.map((f) => `"${f}"`).join(' ');
    return [
      `npx eslint --config backend/eslint.config.mjs --fix ${files}`,
      `npx prettier --config backend/.prettierrc --write ${files}`,
    ];
  },
  'frontend/**/*.js': (filenames) => {
    const relativeFiles = filenames
      .map((f) => path.relative(path.resolve(__dirname, 'frontend'), f))
      .map((f) => `"${f}"`)
      .join(' ');
    return [
      `cd frontend && npx eslint --fix ${relativeFiles}`,
      `cd frontend && npx prettier --config .prettierrc --write ${relativeFiles}`,
    ];
  },
};
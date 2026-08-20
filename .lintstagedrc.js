module.exports = {
  'backend/**/*.js': (filenames) => {
    const files = filenames.map((f) => `"${f}"`).join(' ');
    return [
      `npx eslint --config backend/eslint.config.mjs --fix ${files}`,
      `npx prettier --config backend/.prettierrc --write ${files}`,
    ];
  },
  'frontend/**/*.js': (filenames) => {
    const files = filenames.map((f) => `"${f}"`).join(' ');
    return [`node scripts/lint-frontend.js ${files}`];
  },
};
const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'src');
const modules = {
  '@mui/icons-material': new Set(Object.keys(require('@mui/icons-material'))),
  '@mui/material': new Set(Object.keys(require('@mui/material'))),
};

const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(entryPath);
      continue;
    }

    if (/\.(js|jsx)$/.test(entry.name)) {
      files.push(entryPath);
    }
  }
}

walk(srcRoot);

const issues = [];
const importPattern = /import\s*\{([^}]*)\}\s*from\s*['"](@mui\/icons-material|@mui\/material)['"]/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let match;

  while ((match = importPattern.exec(content)) !== null) {
    const names = match[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => name.split(/\s+as\s+/)[0].trim());

    for (const name of names) {
      if (!modules[match[2]].has(name)) {
        issues.push(`${path.relative(path.join(__dirname, '..'), file)}: ${name} missing from ${match[2]}`);
      }
    }
  }
}

if (issues.length > 0) {
  console.log(issues.join('\n'));
  process.exit(1);
}

console.log('OK');

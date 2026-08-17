#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_INPUTS = [
  'src-tauri/target/release/bundle',
  'dist',
];
const DEFAULT_OUTPUT = 'release-artifacts/SHA256SUMS.txt';
const DEFAULT_EXTENSIONS = new Set([
  '.exe',
  '.msi',
  '.zip',
  '.dmg',
  '.pkg',
  '.tar',
  '.gz',
  '.bz2',
  '.xz',
  '.7z',
  '.blockmap',
]);

function parseArgs(rawArgs) {
  const inputs = [];
  let output = DEFAULT_OUTPUT;
  const args = [...rawArgs];

  while (args.length > 0) {
    const token = args.shift();
    if (token === '--input') {
      const value = args.shift();
      if (!value) {
        throw new Error('Missing value for --input');
      }
      inputs.push(value);
      continue;
    }
    if (token === '--output') {
      const value = args.shift();
      if (!value) {
        throw new Error('Missing value for --output');
      }
      output = value;
      continue;
    }
    if (token === '--help' || token === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return {
    inputs: inputs.length > 0 ? inputs : DEFAULT_INPUTS,
    output,
  };
}

function printHelp() {
  console.log('Usage: node scripts/release/gen_checksums.cjs [--input <dir>]... [--output <file>]');
  console.log('');
  console.log('Defaults:');
  console.log(`  --input  ${DEFAULT_INPUTS.join(', ')}`);
  console.log(`  --output ${DEFAULT_OUTPUT}`);
}

function shouldInclude(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tar.bz2') || lower.endsWith('.tar.xz')) {
    return true;
  }
  const ext = path.extname(lower);
  return DEFAULT_EXTENSIONS.has(ext);
}

function walkFiles(rootDir, result) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, result);
      continue;
    }
    if (entry.isFile() && shouldInclude(fullPath)) {
      result.push(fullPath);
    }
  }
}

function collectFiles(inputDirs) {
  const files = [];
  for (const dir of inputDirs) {
    const abs = path.resolve(dir);
    if (!fs.existsSync(abs)) {
      console.log(`[skip] input not found: ${dir}`);
      continue;
    }
    if (!fs.statSync(abs).isDirectory()) {
      console.log(`[skip] input is not a directory: ${dir}`);
      continue;
    }
    walkFiles(abs, files);
  }
  files.sort((a, b) => a.localeCompare(b));
  return files;
}

function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function main() {
  const { inputs, output } = parseArgs(process.argv.slice(2));
  console.log('Generating SHA256 checksums...');
  console.log(`Inputs: ${inputs.join(', ')}`);

  const files = collectFiles(inputs);
  if (files.length === 0) {
    throw new Error('No release artifacts found in input directories.');
  }

  const lines = [];
  for (const filePath of files) {
    const digest = await sha256(filePath);
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const displayPath = relativePath.startsWith('..')
      ? path.resolve(filePath).replace(/\\/g, '/')
      : relativePath;
    lines.push(`${digest}  ${displayPath}`);
    console.log(`[ok] ${displayPath}`);
  }

  const outputPath = path.resolve(output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
  console.log(`\nDone. Wrote ${lines.length} checksums to: ${path.relative(process.cwd(), outputPath)}`);
}

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  process.exit(1);
});

#!/usr/bin/env node
// Generate per-student CEE 406 datasets and the instructor answer key.
//
//   node --experimental-strip-types scripts/generate-datasets.mjs \
//        --roster roster.csv --salt "fall-2026-<something-secret>" --out dist-datasets
//
// The roster is a CSV whose first column is the UIN; a header row is skipped
// automatically if the first cell is not numeric. Optional second column is a
// name, used only to label the output folder.
//
// Output:
//   <out>/<uin>/…          the student's files — hand these out
//   <out>/_answer-key.json the truth values — do NOT hand these out
//
// ── On the salt ────────────────────────────────────────────────────────────
// This repository is readable by the students. Without a secret salt, anyone
// can run this file with their own UIN and read the k-values they are supposed
// to be regressing. Choose a salt nobody else knows, keep it out of git, and
// change it every semester. The script refuses to run without one.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { studentBundle, studentFiles, answerKey } from './datasets.mjs';
import { basin } from '../src/components/react/backcalc/equations.ts';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--')) continue;
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

function readRoster(path) {
  const text = readFileSync(path, 'utf8');
  const rows = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const uins = [];
  for (const row of rows) {
    const first = row.split(/[,\t;]/)[0].trim();
    if (!first || !/^\d[\d-]*$/.test(first)) continue;   // skips a header row
    uins.push(first);
  }
  return uins;
}

const args = parseArgs(process.argv.slice(2));

if (!args.salt) {
  console.error(
    'Refusing to run without --salt.\n\n' +
    'The generator is deterministic and this repository is public to the class, so an\n' +
    'unsalted run produces data whose answers any student can re-derive from the source.\n' +
    'Pick a per-semester secret, keep it out of git, and pass it here.'
  );
  process.exit(1);
}

const outDir = args.out ?? 'dist-datasets';
const uins = args.roster
  ? readRoster(args.roster)
  : (args.uin ? [args.uin] : null);

if (!uins || uins.length === 0) {
  console.error('Nothing to generate. Pass --roster <file.csv> or --uin <single-uin>.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const keys = [];
for (const uin of uins) {
  const bundle = studentBundle(uin, args.salt, basin);
  const dir = join(outDir, uin);
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(studentFiles(bundle))) {
    writeFileSync(join(dir, name), body, 'utf8');
  }
  keys.push(answerKey(bundle));
  process.stdout.write(`  ${uin}\n`);
}

writeFileSync(
  join(outDir, '_answer-key.json'),
  JSON.stringify({ generated: new Date().toISOString(), students: keys }, null, 2),
  'utf8'
);

console.log(
  `\n${keys.length} student bundle(s) written to ${outDir}/\n` +
  `Answer key: ${join(outDir, '_answer-key.json')} — do not publish this file.`
);

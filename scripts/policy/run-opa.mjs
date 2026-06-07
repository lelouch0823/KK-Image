#!/usr/bin/env node
import { runOpa } from './opa-utils.mjs';

const args = process.argv.slice(2);

if (!args.length) {
  console.error('Usage: node scripts/policy/run-opa.mjs <opa-args...>');
  process.exit(1);
}

try {
  runOpa(args);
} catch (err) {
  console.error('[authz] failed to run opa:', err.message);
  process.exit(1);
}

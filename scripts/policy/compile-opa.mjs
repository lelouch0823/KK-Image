#!/usr/bin/env node
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { runCompileOpaCli } from './compile-opa-lib.mjs';

export * from './compile-opa-lib.mjs';

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCompileOpaCli();
}

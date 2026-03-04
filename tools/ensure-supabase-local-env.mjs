import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const path = resolve(scriptDir, '../src/environments/environment.supabase.local.ts');

if (!existsSync(path)) {
  console.error(
    [
      'Missing src/environments/environment.supabase.local.ts.',
      'Create it from src/environments/environment.supabase.local.example.ts and fill your Supabase values.',
      'This file is gitignored by design.'
    ].join('\n')
  );
  process.exit(1);
}

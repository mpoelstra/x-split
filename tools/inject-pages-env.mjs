import { readFileSync, writeFileSync } from 'node:fs';

const filePath = 'src/environments/environment.production.ts';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Configure them in GitHub Actions variables/secrets.'
  );
  process.exit(1);
}

if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
  console.error('SUPABASE_URL must look like https://<project-ref>.supabase.co');
  process.exit(1);
}

const file = readFileSync(filePath, 'utf8');
const next = file
  .replace(/supabaseUrl:\s*'[^']*'/, `supabaseUrl: '${supabaseUrl}'`)
  .replace(/supabaseAnonKey:\s*'[^']*'/, `supabaseAnonKey: '${supabaseAnonKey}'`);

if (next === file) {
  console.error(`Could not update Supabase values in ${filePath}`);
  process.exit(1);
}

writeFileSync(filePath, next, 'utf8');
console.log(`Injected Supabase config into ${filePath}`);

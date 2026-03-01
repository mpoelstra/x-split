import { AppEnvironment } from '../app/core/env/app-environment';

export const environment: AppEnvironment = {
  production: true,
  mode: 'supabase',
  authBypass: false,
  appName: 'X-Split',
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};

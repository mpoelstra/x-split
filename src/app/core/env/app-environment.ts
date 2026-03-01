export type AppMode = 'stub' | 'supabase';

export interface AppEnvironment {
  production: boolean;
  mode: AppMode;
  authBypass: boolean;
  appName: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

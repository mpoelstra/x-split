import { inject, Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { APP_ENV } from '../env/app-env.token';

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  private readonly env = inject(APP_ENV);
  // In local dev Chrome sometimes rejects Navigator Lock acquisition;
  // use an in-process lock to avoid noisy lock timeout errors.
  private readonly localAuthLock = async <T>(
    _name: string,
    _acquireTimeout: number,
    fn: () => Promise<T>
  ): Promise<T> => fn();
  private readonly clientInstance: SupabaseClient = createClient(
    this.env.supabaseUrl,
    this.env.supabaseAnonKey,
    {
      auth: {
        lock: this.localAuthLock
      }
    }
  );

  get client(): SupabaseClient {
    return this.clientInstance;
  }
}

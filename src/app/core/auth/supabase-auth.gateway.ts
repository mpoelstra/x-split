import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Session } from '@supabase/supabase-js';
import { IAuthGateway } from './auth-gateway';
import { UserProfile } from '../models/domain.models';
import { SupabaseClientService } from '../supabase/supabase-client.service';

@Injectable()
export class SupabaseAuthGateway implements IAuthGateway {
  private readonly userSubject = new BehaviorSubject<UserProfile | null>(null);
  private readonly client = inject(SupabaseClientService).client;
  private readonly document = inject(DOCUMENT);
  private authStateListenerBound = false;

  user$(): Observable<UserProfile | null> {
    return this.userSubject.asObservable();
  }

  async init(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    this.pushFromSession(data.session);

    if (!this.authStateListenerBound) {
      this.client.auth.onAuthStateChange((_event, session) => {
        this.pushFromSession(session);
      });
      this.authStateListenerBound = true;
    }
  }

  async signInWithGoogle(): Promise<void> {
    const redirectTo = new URL('app/dashboard', this.document.baseURI).toString();
    await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    });
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    this.userSubject.next(null);
  }

  private pushFromSession(session: Session | null): void {
    if (!session?.user) {
      this.userSubject.next(null);
      return;
    }

    this.userSubject.next({
      id: session.user.id,
      email: session.user.email ?? '',
      displayName: session.user.user_metadata['full_name'] ?? session.user.email ?? 'Unknown user',
      avatarUrl: session.user.user_metadata['avatar_url']
    });
  }
}

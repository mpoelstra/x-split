import { inject, Injectable, signal } from '@angular/core';
import { AUTH_GATEWAY } from './auth-gateway';
import { UserProfile } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly userSignal = signal<UserProfile | null>(null);
  private initialized = false;
  private initInFlight: Promise<void> | null = null;

  constructor() {
    this.gateway.user$().subscribe((user) => {
      this.userSignal.set(user);
    });
  }

  user = this.userSignal.asReadonly();

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initInFlight) {
      await this.initInFlight;
      return;
    }

    this.initInFlight = this.gateway
      .init()
      .then(() => {
        this.initialized = true;
      })
      .finally(() => {
        this.initInFlight = null;
      });

    await this.initInFlight;
  }

  async signInWithGoogle(): Promise<void> {
    await this.gateway.signInWithGoogle();
  }

  async signOut(): Promise<void> {
    await this.gateway.signOut();
  }
}

import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { UserProfile } from '../models/domain.models';

export interface IAuthGateway {
  user$(): Observable<UserProfile | null>;
  init(): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export const AUTH_GATEWAY = new InjectionToken<IAuthGateway>('AUTH_GATEWAY');

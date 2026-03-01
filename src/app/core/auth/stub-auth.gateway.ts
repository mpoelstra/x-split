import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { IAuthGateway } from './auth-gateway';
import { UserProfile } from '../models/domain.models';

@Injectable()
export class StubAuthGateway implements IAuthGateway {
  private readonly userSubject = new BehaviorSubject<UserProfile | null>(null);

  constructor(private readonly http: HttpClient) {}

  user$(): Observable<UserProfile | null> {
    return this.userSubject.asObservable();
  }

  async init(): Promise<void> {
    const me = await firstValueFrom(this.http.get<UserProfile>('/api/me'));
    this.userSubject.next(me);
  }

  async signInWithGoogle(): Promise<void> {
    if (!this.userSubject.value) {
      await this.init();
    }
  }

  async signOut(): Promise<void> {
    this.userSubject.next(null);
  }
}

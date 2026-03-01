import { APP_INITIALIZER, ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { APP_ENV } from './core/env/app-env.token';
import { StubInterceptor } from './core/stub/stub.interceptor';
import { AUTH_GATEWAY } from './core/auth/auth-gateway';
import { StubAuthGateway } from './core/auth/stub-auth.gateway';
import { SupabaseAuthGateway } from './core/auth/supabase-auth.gateway';
import { DATA_GATEWAY } from './core/data/data-gateway';
import { StubDataGateway } from './core/data/stub-data.gateway';
import { SupabaseDataGateway } from './core/data/supabase-data.gateway';
import { AuthService } from './core/auth/auth.service';

const initializeAuth = (auth: AuthService) => () => auth.init();

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    { provide: APP_ENV, useValue: environment },
    {
      provide: AUTH_GATEWAY,
      useClass: environment.mode === 'stub' ? StubAuthGateway : SupabaseAuthGateway
    },
    {
      provide: DATA_GATEWAY,
      useClass: environment.mode === 'stub' ? StubDataGateway : SupabaseDataGateway
    },
    ...(environment.mode === 'stub'
      ? [{ provide: HTTP_INTERCEPTORS, useClass: StubInterceptor, multi: true }]
      : []),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      deps: [AuthService],
      multi: true
    }
  ]
};

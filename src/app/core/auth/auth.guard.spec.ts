import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { APP_ENV } from '../env/app-env.token';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  it('allows access in stub mode', async () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: APP_ENV,
          useValue: {
            authBypass: true
          }
        }
      ]
    });

    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBeTrue();
  });

  it('redirects to login in supabase mode when no user', async () => {
    const parseUrl = jasmine.createSpy('parseUrl').and.returnValue({} as UrlTree);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: APP_ENV,
          useValue: {
            authBypass: false
          }
        },
        {
          provide: AuthService,
          useValue: {
            init: async () => Promise.resolve(),
            user: () => null
          }
        },
        {
          provide: Router,
          useValue: {
            parseUrl
          }
        }
      ]
    });

    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toEqual(jasmine.any(Object));
    expect(parseUrl).toHaveBeenCalledWith('/login');
  });
});

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { AUTH_GATEWAY } from './core/auth/auth-gateway';

describe('AppComponent', () => {
  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: AUTH_GATEWAY,
          useValue: {
            user$: () => of(null),
            init: async () => Promise.resolve(),
            signInWithGoogle: async () => Promise.resolve(),
            signOut: async () => Promise.resolve()
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});

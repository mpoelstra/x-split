import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { APP_ENV } from '../../core/env/app-env.token';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly env = inject(APP_ENV);

  readonly authBypass = this.env.authBypass;

  async signIn(): Promise<void> {
    await this.auth.signInWithGoogle();
    await this.router.navigateByUrl('/app/dashboard');
  }

  async continueStub(): Promise<void> {
    await this.router.navigateByUrl('/app/dashboard');
  }
}

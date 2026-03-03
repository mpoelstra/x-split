import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_ENV } from '../../core/env/app-env.token';
import { AuthService } from '../../core/auth/auth.service';
import { ExpenseService } from '../../core/data/expense.service';

@Component({
  selector: 'app-account',
  imports: [RouterLink],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly env = inject(APP_ENV);
  private readonly expenseService = inject(ExpenseService);

  readonly user = this.auth.user;
  readonly mode = this.env.mode;
  readonly authBypass = this.env.authBypass;
  readonly isAdmin = computed(() => this.user()?.email?.toLowerCase() === 'm.poelstra@gmail.com');
  readonly adminResetBusy = signal(false);
  readonly adminResetDone = signal(false);
  avatarLoadFailed = false;
  readonly initials = computed(() => {
    const source = this.user()?.displayName?.trim() || this.user()?.email || 'A';
    const parts = source.split(/\s+/).filter((part) => part.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  });

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }

  onAvatarLoadError(): void {
    this.avatarLoadFailed = true;
  }

  async adminResetData(): Promise<void> {
    if (!this.isAdmin() || this.adminResetBusy()) {
      return;
    }

    const confirmed = window.confirm(
      'This will delete all bills, invites, expenses, groups, memberships, and non-admin profiles. Continue?'
    );
    if (!confirmed) {
      return;
    }

    this.adminResetBusy.set(true);
    this.adminResetDone.set(false);
    try {
      await firstValueFrom(this.expenseService.adminResetData());
      this.adminResetDone.set(true);
    } finally {
      this.adminResetBusy.set(false);
    }
  }
}

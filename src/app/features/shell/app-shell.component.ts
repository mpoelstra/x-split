import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { BalanceSummary, Bill, Group } from '../../core/models/domain.models';

type BillTone = 'owed' | 'owe' | 'even';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);

  readonly user = this.authService.user;
  readonly group = signal<Group | null>(null);
  readonly bills = signal<Bill[]>([]);
  readonly currentBill = signal<Bill | null>(null);
  readonly balances = signal<BalanceSummary[]>([]);
  readonly switchingBill = signal(false);
  readonly avatarLoadFailed = signal(false);
  readonly userDisplayName = computed(() => this.user()?.displayName || 'Account');
  readonly userInitials = computed(() => {
    const source = this.user()?.displayName?.trim() || this.user()?.email || 'A';
    const parts = source.split(/\s+/).filter((part) => part.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  });
  readonly currentBalance = computed(() => {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return 0;
    }

    const member = group.members.find((entry) => entry.profileId === me.id);
    if (!member) {
      return 0;
    }

    return this.balances().find((entry) => entry.memberId === member.id)?.balance ?? 0;
  });
  readonly billTone = computed<BillTone>(() => {
    const value = this.currentBalance();
    if (value > 0.01) {
      return 'owed';
    }
    if (value < -0.01) {
      return 'owe';
    }
    return 'even';
  });
  readonly billAmount = computed(() => Math.round(Math.abs(this.currentBalance()) * 100) / 100);

  constructor() {
    this.expenseService.getCurrentGroup()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (group) => this.group.set(group),
      error: () => this.group.set(null)
    });
    this.expenseService.getBills()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (bills) => this.bills.set(bills),
      error: () => this.bills.set([])
    });
    this.expenseService.getCurrentBill()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (bill) => this.currentBill.set(bill),
      error: () => this.currentBill.set(null)
    });
    this.expenseService.getBalances()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (balances) => this.balances.set(balances),
      error: () => this.balances.set([])
    });
  }

  async onBillSelect(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const billId = select.value;
    if (!billId || billId === this.currentBill()?.id) {
      return;
    }

    this.switchingBill.set(true);
    try {
      await firstValueFrom(this.expenseService.setCurrentBill(billId));
    } finally {
      this.switchingBill.set(false);
    }
  }

  onAvatarLoadError(): void {
    this.avatarLoadFailed.set(true);
  }
}

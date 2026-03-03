import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { BalanceSummary, Bill, Expense, Group } from '../../core/models/domain.models';
import { trueAchievementsGameUrl } from '../../core/utils/trueachievements-link';
import { APP_ENV } from '../../core/env/app-env.token';

@Component({
    selector: 'app-dashboard',
    imports: [CurrencyPipe, RouterLink],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);
  private readonly env = inject(APP_ENV);

  readonly user = this.authService.user;
  readonly group = signal<Group | null>(null);
  readonly currentBill = signal<Bill | null>(null);
  readonly expenses = signal<Expense[]>([]);
  readonly balances = signal<BalanceSummary[]>([]);
  readonly isStub = this.env.mode === 'stub';

  readonly totalExpenses = computed(() =>
    this.expenses().reduce((sum, expense) => sum + expense.amount, 0)
  );

  readonly recentActivity = computed(() => this.expenses().slice(0, 20));
  readonly currencyCode = computed(() => this.expenses()[0]?.currency || 'EUR');

  readonly myBalance = computed(() => {
    const me = this.user();
    const group = this.group();
    if (!me || !group) {
      return 0;
    }

    const member = group.members.find((m) => m.profileId === me.id);
    if (!member) {
      return 0;
    }

    return this.balances().find((balance) => balance.memberId === member.id)?.balance ?? 0;
  });

  constructor() {
    this.expenseService.getCurrentGroup()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (group) => this.group.set(group),
      error: () => this.group.set(null)
    });
    this.expenseService.getCurrentBill()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (bill) => this.currentBill.set(bill),
      error: () => this.currentBill.set(null)
    });
    this.expenseService.getExpenses()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (expenses) => this.expenses.set(expenses),
      error: () => this.expenses.set([])
    });
    this.expenseService.getBalances()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (balances) => this.balances.set(balances),
      error: () => this.balances.set([])
    });
  }

  async resetDemoData(): Promise<void> {
    await firstValueFrom(this.expenseService.adminResetData());
  }

  payerName(memberId: string): string {
    return this.group()?.members.find((member) => member.id === memberId)?.displayName ?? 'Member';
  }

  paidByCurrentUser(expense: Expense): boolean {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return false;
    }

    const meMember = group.members.find((member) => member.profileId === me.id);
    return meMember?.id === expense.paidByMemberId;
  }

  expenseGameUrl(expense: Expense): string {
    return expense.trueAchievementsUrl || trueAchievementsGameUrl(expense.gameTitle);
  }
}

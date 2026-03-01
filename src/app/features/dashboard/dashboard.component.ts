import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { BalanceSummary, Bill, Expense, Group } from '../../core/models/domain.models';
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
  private readonly http = inject(HttpClient);
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

  readonly recentActivity = computed(() => this.expenses().slice(0, 5));

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
    this.reload();
    this.expenseService.billSelectionChanged$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.reload());
  }

  reload(): void {
    this.expenseService.getCurrentGroup().subscribe({
      next: (group) => this.group.set(group),
      error: () => this.group.set(null)
    });
    this.expenseService.getCurrentBill().subscribe({
      next: (bill) => this.currentBill.set(bill),
      error: () => this.currentBill.set(null)
    });
    this.expenseService.getExpenses().subscribe({
      next: (expenses) => this.expenses.set(expenses),
      error: () => this.expenses.set([])
    });
    this.expenseService.getBalances().subscribe({
      next: (balances) => this.balances.set(balances),
      error: () => this.balances.set([])
    });
  }

  resetDemoData(): void {
    this.http.post('/api/reset', {}).subscribe(() => this.reload());
  }

  payerName(memberId: string): string {
    return this.group()?.members.find((member) => member.id === memberId)?.displayName ?? 'Member';
  }
}

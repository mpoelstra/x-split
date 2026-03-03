import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
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
  readonly groupLoadError = signal(false);
  readonly currentBillLoadError = signal(false);
  readonly expensesLoadError = signal(false);
  readonly balancesLoadError = signal(false);
  readonly hasLoadError = computed(
    () => this.groupLoadError() || this.currentBillLoadError() || this.expensesLoadError() || this.balancesLoadError()
  );
  readonly group = toSignal(
    this.expenseService.getCurrentGroup().pipe(
      catchError(() => {
        this.groupLoadError.set(true);
        return of<Group | null>(null);
      })
    ),
    { initialValue: null }
  );
  readonly currentBill = toSignal(
    this.expenseService.getCurrentBill().pipe(
      catchError(() => {
        this.currentBillLoadError.set(true);
        return of<Bill | null>(null);
      })
    ),
    { initialValue: null }
  );
  readonly expenses = toSignal(
    this.expenseService.getExpenses().pipe(
      catchError(() => {
        this.expensesLoadError.set(true);
        return of<Expense[]>([]);
      })
    ),
    { initialValue: [] }
  );
  readonly balances = toSignal(
    this.expenseService.getBalances().pipe(
      catchError(() => {
        this.balancesLoadError.set(true);
        return of<BalanceSummary[]>([]);
      })
    ),
    { initialValue: [] }
  );
  readonly isStub = this.env.mode === 'stub';

  readonly totalExpenses = computed(() =>
    this.expenses().reduce((sum, expense) => sum + expense.amount, 0)
  );

  readonly recentActivity = computed(() => this.expenses().slice(0, 20));
  readonly currencyCode = computed(() => this.expenses()[0]?.currency || 'EUR');
  readonly currentMemberId = computed(() => {
    const me = this.user();
    const group = this.group();
    if (!me || !group) {
      return null;
    }

    return group.members.find((member) => member.profileId === me.id)?.id ?? null;
  });
  readonly memberNameMap = computed(() => {
    const members = this.group()?.members ?? [];
    return new Map(members.map((member) => [member.id, member.displayName]));
  });

  readonly myBalance = computed(() => {
    const currentMemberId = this.currentMemberId();
    if (!currentMemberId) {
      return 0;
    }

    return this.balances().find((balance) => balance.memberId === currentMemberId)?.balance ?? 0;
  });

  async resetDemoData(): Promise<void> {
    await firstValueFrom(this.expenseService.adminResetData());
  }

  payerName(memberId: string): string {
    return this.memberNameMap().get(memberId) ?? 'Member';
  }

  paidByCurrentUser(expense: Expense): boolean {
    return this.currentMemberId() === expense.paidByMemberId;
  }

  expenseGameUrl(expense: Expense): string {
    return expense.trueAchievementsUrl || trueAchievementsGameUrl(expense.gameTitle);
  }
}

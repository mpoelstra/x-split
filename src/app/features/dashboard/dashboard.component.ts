import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { BalanceSummary, Bill, Expense, Group } from '../../core/models/domain.models';
import { trueAchievementsGameUrl } from '../../core/utils/trueachievements-link';
import { APP_ENV } from '../../core/env/app-env.token';
import { compareExpensesNewestFirst } from '../../core/utils/expense-sort';

@Component({
    selector: 'app-dashboard',
    imports: [CurrencyPipe, RouterLink],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  private static readonly ACTIVITY_SEEN_STORAGE_PREFIX = 'xsplit:activity-seen';
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);
  private readonly env = inject(APP_ENV);
  private readonly readStateVersion = signal(0);
  private readonly inMemoryReadState = new Map<string, string>();

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

  readonly recentActivity = computed(() => [...this.expenses()].sort(compareExpensesNewestFirst).slice(0, 20));
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
  readonly unreadExpenseIds = computed(() => {
    this.readStateVersion();
    const user = this.user();
    const bill = this.currentBill();
    if (!user || !bill) {
      return new Set<string>();
    }

    const lastSeenAt = this.readLastSeenAt(this.storageKey(user.id, bill.id));
    if (!lastSeenAt) {
      return new Set<string>();
    }

    const unreadIds = this.expenses()
      .filter((expense) => this.isUnreadExpenseForUser(expense, user.id, lastSeenAt))
      .map((expense) => expense.id);

    return new Set(unreadIds);
  });
  readonly unreadExpenseCount = computed(() => this.unreadExpenseIds().size);

  readonly myBalance = computed(() => {
    const currentMemberId = this.currentMemberId();
    if (!currentMemberId) {
      return 0;
    }

    return this.balances().find((balance) => balance.memberId === currentMemberId)?.balance ?? 0;
  });

  constructor() {
    effect(() => {
      const user = this.user();
      const bill = this.currentBill();
      const expenses = this.expenses();
      if (!user || !bill || expenses.length === 0) {
        return;
      }

      const key = this.storageKey(user.id, bill.id);
      if (this.readLastSeenAt(key)) {
        return;
      }

      const baseline = this.latestRelevantActivityAt(user.id) ?? new Date().toISOString();
      this.writeLastSeenAt(key, baseline);
      this.readStateVersion.update((version) => version + 1);
    });
  }

  async resetDemoData(): Promise<void> {
    await firstValueFrom(this.expenseService.adminResetData());
  }

  markActivityAsRead(): void {
    const user = this.user();
    const bill = this.currentBill();
    if (!user || !bill) {
      return;
    }

    const latest = this.latestRelevantActivityAt(user.id) ?? new Date().toISOString();
    this.writeLastSeenAt(this.storageKey(user.id, bill.id), latest);
    this.readStateVersion.update((version) => version + 1);
  }

  payerName(memberId: string): string {
    return this.memberNameMap().get(memberId) ?? 'Member';
  }

  billCounterpartyName(bill: Bill): string {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return bill.friendName;
    }

    const meMember = group.members.find((member) => member.profileId === me.id);
    if (!meMember) {
      return bill.friendName;
    }

    if (bill.friendMemberId) {
      if (bill.friendMemberId === meMember.id) {
        const owner = group.members.find((member) => member.role === 'owner' && member.id !== meMember.id);
        const fallback = group.members.find((member) => member.id !== meMember.id);
        return owner?.displayName ?? fallback?.displayName ?? bill.friendName;
      }

      return group.members.find((member) => member.id === bill.friendMemberId)?.displayName ?? bill.friendName;
    }

    return bill.friendName;
  }

  paidByCurrentUser(expense: Expense): boolean {
    return this.currentMemberId() === expense.paidByMemberId;
  }

  expenseGameUrl(expense: Expense): string {
    return expense.trueAchievementsUrl || trueAchievementsGameUrl(expense.gameTitle);
  }

  isUnreadExpense(expense: Expense): boolean {
    return this.unreadExpenseIds().has(expense.id);
  }

  private isUnreadExpenseForUser(expense: Expense, userId: string, lastSeenAt: string): boolean {
    if (!expense.createdAt || expense.createdAt <= lastSeenAt) {
      return false;
    }

    if (!expense.createdByProfileId) {
      return false;
    }

    return expense.createdByProfileId !== userId;
  }

  private latestRelevantActivityAt(userId: string): string | null {
    const createdAtValues = this.expenses()
      .filter((expense) => expense.createdByProfileId && expense.createdByProfileId !== userId)
      .map((expense) => expense.createdAt)
      .filter((createdAt): createdAt is string => Boolean(createdAt));

    if (createdAtValues.length === 0) {
      return null;
    }

    return createdAtValues.reduce((latest, current) => (current > latest ? current : latest));
  }

  private storageKey(userId: string, billId: string): string {
    return `${DashboardComponent.ACTIVITY_SEEN_STORAGE_PREFIX}:${userId}:${billId}`;
  }

  private readLastSeenAt(key: string): string | null {
    const inMemory = this.inMemoryReadState.get(key);
    if (inMemory) {
      return inMemory;
    }

    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private writeLastSeenAt(key: string, value: string): void {
    this.inMemoryReadState.set(key, value);

    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Ignore storage unavailability.
    }
  }
}

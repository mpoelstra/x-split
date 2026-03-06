import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { Bill, Expense, Group } from '../../core/models/domain.models';
import { trueAchievementsGameUrl } from '../../core/utils/trueachievements-link';
import { compareExpensesNewestFirst } from '../../core/utils/expense-sort';

type ExpenseSort = 'date_desc' | 'title_asc' | 'title_desc' | 'amount_asc' | 'amount_desc';

@Component({
    selector: 'app-expenses-list',
    imports: [RouterLink, DecimalPipe],
    templateUrl: './expenses-list.component.html',
    styleUrl: './expenses-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpensesListComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  readonly user = this.authService.user;
  readonly group = signal<Group | null>(null);
  readonly currentBill = signal<Bill | null>(null);
  readonly expenses = signal<Expense[]>([]);
  readonly deletingExpenseId = signal<string | null>(null);
  readonly query = signal('');
  readonly sortBy = signal<ExpenseSort>('date_desc');
  readonly isMobileLayout = signal(false);
  readonly filteredExpenses = computed(() => {
    const query = this.query().trim().toLowerCase();
    const sorted = [...this.expenses()];

    switch (this.sortBy()) {
      case 'title_asc':
        sorted.sort((a, b) => a.gameTitle.localeCompare(b.gameTitle));
        break;
      case 'title_desc':
        sorted.sort((a, b) => b.gameTitle.localeCompare(a.gameTitle));
        break;
      case 'amount_asc':
        sorted.sort((a, b) => a.amount - b.amount);
        break;
      case 'amount_desc':
        sorted.sort((a, b) => b.amount - a.amount);
        break;
      case 'date_desc':
      default:
        sorted.sort(compareExpensesNewestFirst);
        break;
    }

    if (!query) {
      return sorted;
    }

    return sorted.filter((expense) => expense.gameTitle.toLowerCase().includes(query));
  });

  constructor() {
    this.initializeViewportWatcher();

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
      next: (items) => this.expenses.set(items),
      error: () => this.expenses.set([])
    });
  }

  paidLabel(expense: Expense): string {
    const payerName = this.memberName(expense.paidByMemberId);
    return this.didCurrentUserPay(expense) ? 'You paid' : `${payerName} paid`;
  }

  loanedLabel(expense: Expense): string {
    if (this.didCurrentUserPay(expense)) {
      return `You loaned ${this.otherMemberName(expense.paidByMemberId)}`;
    }

    return `${this.memberName(expense.paidByMemberId)} loaned you`;
  }

  loanedAmount(expense: Expense): number {
    if (typeof expense.netToPayer === 'number' && Number.isFinite(expense.netToPayer)) {
      return expense.netToPayer;
    }

    const memberCount = Math.max(this.group()?.members.length ?? 2, 1);
    return expense.amount / memberCount;
  }

  didCurrentUserPay(expense: Expense): boolean {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return false;
    }

    const meMember = group.members.find((member) => member.profileId === me.id);
    return meMember?.id === expense.paidByMemberId;
  }

  canDelete(expense: Expense): boolean {
    const bill = this.currentBill();
    if (!bill || expense.billId !== bill.id) {
      return false;
    }

    return this.isCurrentUserBillMember(bill);
  }

  async deleteExpense(expense: Expense): Promise<void> {
    if (!this.canDelete(expense) || this.deletingExpenseId()) {
      return;
    }

    const confirmed = window.confirm(`Delete "${expense.gameTitle}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    this.deletingExpenseId.set(expense.id);
    try {
      await firstValueFrom(this.expenseService.deleteExpense(expense.id));
    } finally {
      this.deletingExpenseId.set(null);
    }
  }

  onQueryChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.query.set(input.value);
  }

  onSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sortBy.set(select.value as ExpenseSort);
  }

  gameUrl(gameTitle: string): string {
    return trueAchievementsGameUrl(gameTitle);
  }

  expenseGameUrl(expense: Expense): string {
    return expense.trueAchievementsUrl || this.gameUrl(expense.gameTitle);
  }

  private initializeViewportWatcher(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 860px)');
    const syncLayout = (event?: MediaQueryList | MediaQueryListEvent) => {
      this.isMobileLayout.set(event?.matches ?? mediaQuery.matches);
    };

    syncLayout(mediaQuery);
    mediaQuery.addEventListener('change', syncLayout);
    this.destroyRef.onDestroy(() => mediaQuery.removeEventListener('change', syncLayout));
  }

  private memberName(memberId: string): string {
    const member = this.group()?.members.find((entry) => entry.id === memberId);
    if (!member) {
      return 'Member';
    }

    return this.firstName(member.displayName);
  }

  private otherMemberName(payerMemberId: string): string {
    const bill = this.currentBill();
    const group = this.group();
    if (bill) {
      if (bill.friendMemberId && bill.friendMemberId !== payerMemberId) {
        const friend = group?.members.find((member) => member.id === bill.friendMemberId);
        if (friend) {
          return this.firstName(friend.displayName);
        }
      }

      if (bill.friendName && (!bill.friendMemberId || bill.friendMemberId !== payerMemberId)) {
        return this.firstName(bill.friendName);
      }
    }

    const members = this.group()?.members ?? [];
    const other = members.find((entry) => entry.id !== payerMemberId);
    if (!other) {
      return 'friend';
    }

    return this.firstName(other.displayName);
  }

  private firstName(displayName: string): string {
    return displayName.trim().split(/\s+/)[0] ?? 'friend';
  }

  private isCurrentUserBillMember(bill: Bill): boolean {
    const me = this.user();
    const group = this.group();
    if (!me || !group) {
      return false;
    }

    if (bill.createdByProfileId && bill.createdByProfileId === me.id) {
      return true;
    }

    const meMember = group.members.find((member) => member.profileId === me.id);
    if (!meMember) {
      return false;
    }

    if (bill.friendMemberId) {
      return bill.friendMemberId === meMember.id;
    }

    return meMember.role === 'owner';
  }
}

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { Bill, Expense, Group } from '../../core/models/domain.models';

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
  readonly user = this.authService.user;
  readonly group = signal<Group | null>(null);
  readonly currentBill = signal<Bill | null>(null);
  readonly expenses = signal<Expense[]>([]);
  readonly deletingExpenseId = signal<string | null>(null);

  constructor() {
    this.expenseService.getCurrentGroup().subscribe({
      next: (group) => this.group.set(group),
      error: () => this.group.set(null)
    });
    this.reload();
    this.expenseService.billSelectionChanged$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.reload());
  }

  private reload(): void {
    this.expenseService.getCurrentBill().subscribe({
      next: (bill) => this.currentBill.set(bill),
      error: () => this.currentBill.set(null)
    });
    this.expenseService.getExpenses().subscribe({
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
    const me = this.user();
    if (!me) {
      return false;
    }

    return expense.createdByProfileId === me.id;
  }

  deleteExpense(expense: Expense): void {
    if (!this.canDelete(expense) || this.deletingExpenseId()) {
      return;
    }

    const confirmed = window.confirm(`Delete "${expense.gameTitle}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    this.deletingExpenseId.set(expense.id);
    this.expenseService.deleteExpense(expense.id).subscribe({
      next: () => this.deletingExpenseId.set(null),
      error: () => this.deletingExpenseId.set(null)
    });
  }

  private memberName(memberId: string): string {
    const member = this.group()?.members.find((entry) => entry.id === memberId);
    if (!member) {
      return 'Member';
    }

    return member.displayName.split(' ')[0];
  }

  private otherMemberName(payerMemberId: string): string {
    const members = this.group()?.members ?? [];
    const other = members.find((entry) => entry.id !== payerMemberId);
    if (!other) {
      return 'friend';
    }

    return other.displayName.split(' ')[0];
  }
}

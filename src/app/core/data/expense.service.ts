import { inject, Injectable } from '@angular/core';
import { DATA_GATEWAY } from './data-gateway';
import {
  BalanceSummary,
  Bill,
  CreateBillInput,
  CreateExpenseInput,
  Expense,
  Group,
  UpdateExpenseInput
} from '../models/domain.models';
import {
  BehaviorSubject,
  Observable,
  Subject,
  combineLatest,
  distinctUntilChanged,
  map,
  of,
  shareReplay,
  switchMap,
  tap
} from 'rxjs';
import { calculateBalances } from '../utils/balance-calculator';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly gateway = inject(DATA_GATEWAY);
  private readonly billSelectionChangedSubject = new Subject<string>();
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly selectedBillIdSubject = new BehaviorSubject<string | null>(null);
  private readonly expensesRefreshSubject = new BehaviorSubject<void>(undefined);

  private readonly currentGroup$ = this.refreshSubject.pipe(
    switchMap(() => this.gateway.getCurrentGroup()),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly bills$ = this.currentGroup$.pipe(
    switchMap(() => this.gateway.getBills()),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly currentBill$ = combineLatest([this.bills$, this.selectedBillIdSubject]).pipe(
    map(([bills, selectedId]) => {
      if (bills.length === 0) {
        return null;
      }

      if (!selectedId) {
        return bills[0];
      }

      return bills.find((bill) => bill.id === selectedId) ?? bills[0];
    }),
    distinctUntilChanged((a, b) => a?.id === b?.id),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly expenses$ = combineLatest([this.currentBill$, this.expensesRefreshSubject]).pipe(
    switchMap(([bill]) => {
      if (!bill) {
        return of([]);
      }

      return this.gateway.getExpenses();
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly balances$ = combineLatest([this.currentGroup$, this.currentBill$, this.expenses$]).pipe(
    map(([group, currentBill, expenses]) => {
      const balanceMembers = this.resolveBalanceMembers(group, currentBill, expenses);
      if (balanceMembers.length === 0) {
        return [];
      }

      return calculateBalances(expenses, balanceMembers);
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly billSelectionChanged$ = this.billSelectionChangedSubject.asObservable();

  getCurrentGroup(): Observable<Group> {
    return this.currentGroup$;
  }

  getBills(): Observable<Bill[]> {
    return this.bills$;
  }

  createBill(input: CreateBillInput): Observable<Bill> {
    return this.gateway.createBill(input).pipe(
      tap((bill) => {
        this.selectedBillIdSubject.next(bill.id);
        this.refresh();
        this.expensesRefresh();
        this.billSelectionChangedSubject.next(bill.id);
      })
    );
  }

  getCurrentBill(): Observable<Bill | null> {
    return this.currentBill$;
  }

  setCurrentBill(billId: string, notify = true): Observable<Bill> {
    return this.gateway.setCurrentBill(billId).pipe(
      tap((bill) => {
        this.selectedBillIdSubject.next(bill.id);
        this.expensesRefresh();
        if (notify) {
          this.billSelectionChangedSubject.next(bill.id);
        }
      })
    );
  }

  ensurePendingInviteMember(billId: string): Observable<string> {
    return this.gateway.ensurePendingInviteMember(billId).pipe(
      tap(() => this.refresh())
    );
  }

  getExpenses(): Observable<Expense[]> {
    return this.expenses$;
  }

  getExpenseById(expenseId: string): Observable<Expense> {
    return this.gateway.getExpenseById(expenseId);
  }

  addExpense(input: CreateExpenseInput): Observable<Expense> {
    return this.gateway.createExpense(input).pipe(
      tap(() => this.expensesRefresh())
    );
  }

  updateExpense(expenseId: string, input: UpdateExpenseInput): Observable<Expense> {
    return this.gateway.updateExpense(expenseId, input).pipe(
      tap(() => this.expensesRefresh())
    );
  }

  deleteExpense(expenseId: string): Observable<void> {
    return this.gateway.deleteExpense(expenseId).pipe(
      tap(() => this.expensesRefresh())
    );
  }

  getBalances(): Observable<BalanceSummary[]> {
    return this.balances$;
  }

  adminResetData(): Observable<void> {
    return this.gateway.adminResetData().pipe(
      tap(() => {
        this.selectedBillIdSubject.next(null);
        this.refresh();
        this.expensesRefresh();
      })
    );
  }

  refresh(): void {
    this.refreshSubject.next(undefined);
  }

  private expensesRefresh(): void {
    this.expensesRefreshSubject.next(undefined);
  }

  private resolveBalanceMembers(group: Group, currentBill: Bill | null, expenses: Expense[]): Group['members'] {
    if (group.members.length <= 2) {
      return group.members;
    }

    const participantIds = new Set<string>();

    if (currentBill?.friendMemberId) {
      participantIds.add(currentBill.friendMemberId);
    }

    for (const expense of expenses) {
      participantIds.add(expense.paidByMemberId);
    }

    const scopedMembers = group.members.filter((member) => participantIds.has(member.id));
    if (scopedMembers.length >= 2) {
      return scopedMembers;
    }

    if (scopedMembers.length === 1) {
      const fallbackMember = group.members.find((member) => member.id !== scopedMembers[0].id);
      if (fallbackMember) {
        return [scopedMembers[0], fallbackMember];
      }
    }

    return group.members;
  }
}

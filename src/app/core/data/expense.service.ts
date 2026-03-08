import { inject, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { DATA_GATEWAY } from './data-gateway';
import {
  BalanceSummary,
  Bill,
  CreateBillInput,
  CreateExpenseInput,
  Expense,
  Group,
  GroupMember,
  UpdateExpenseInput
} from '../models/domain.models';
import { AuthService } from '../auth/auth.service';
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
  private static readonly BILL_STORAGE_KEY = 'xsplit:selected-bill-id';
  private readonly gateway = inject(DATA_GATEWAY);
  private readonly authService = inject(AuthService);
  private readonly billSelectionChangedSubject = new Subject<string>();
  private readonly refreshSubject = new BehaviorSubject<void>(undefined);
  private readonly selectedBillIdSubject = new BehaviorSubject<string | null>(this.readPersistedBillId());
  private readonly expensesRefreshSubject = new BehaviorSubject<void>(undefined);
  private syncedGatewayBillId: string | null = null;
  private readonly currentUser$ = toObservable(this.authService.user);

  private readonly currentGroup$ = this.refreshSubject.pipe(
    switchMap(() => this.gateway.getCurrentGroup()),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly bills$ = combineLatest([this.currentGroup$, this.currentUser$]).pipe(
    switchMap(([group, user]) =>
      this.gateway.getBills().pipe(
        map((bills) => bills.filter((bill) => this.isBillAccessibleToUser(group, user?.id ?? null, bill)))
      )
    ),
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
    tap((bill) => {
      const activeBillId = bill?.id ?? null;
      if (this.selectedBillIdSubject.value !== activeBillId) {
        this.selectedBillIdSubject.next(activeBillId);
      }
      this.persistBillId(activeBillId);
    }),
    distinctUntilChanged((a, b) => a?.id === b?.id),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly expenses$ = combineLatest([this.currentBill$, this.expensesRefreshSubject]).pipe(
    switchMap(([bill]) => {
      if (!bill) {
        return of([]);
      }

      if (this.syncedGatewayBillId !== bill.id) {
        return this.gateway.setCurrentBill(bill.id).pipe(
          tap((selectedBill) => {
            this.syncedGatewayBillId = selectedBill.id;
          }),
          switchMap(() => this.gateway.getExpenses())
        );
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
        this.selectBillId(bill.id);
        this.syncedGatewayBillId = bill.id;
        this.refresh();
        this.expensesRefresh();
        this.billSelectionChangedSubject.next(bill.id);
      })
    );
  }

  deleteBill(billId: string): Observable<void> {
    return this.gateway.deleteBill(billId).pipe(
      tap(() => {
        if (this.selectedBillIdSubject.value === billId) {
          this.selectBillId(null);
        }
        this.syncedGatewayBillId = null;
        this.refresh();
        this.expensesRefresh();
      })
    );
  }

  getCurrentBill(): Observable<Bill | null> {
    return this.currentBill$;
  }

  setCurrentBill(billId: string, notify = true): Observable<Bill> {
    return this.gateway.setCurrentBill(billId).pipe(
      tap((bill) => {
        this.selectBillId(bill.id);
        this.syncedGatewayBillId = bill.id;
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
        this.selectBillId(null);
        this.syncedGatewayBillId = null;
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

  private selectBillId(billId: string | null): void {
    this.selectedBillIdSubject.next(billId);
    this.persistBillId(billId);
  }

  private readPersistedBillId(): string | null {
    try {
      return globalThis.localStorage?.getItem(ExpenseService.BILL_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private persistBillId(billId: string | null): void {
    try {
      if (!billId) {
        globalThis.localStorage?.removeItem(ExpenseService.BILL_STORAGE_KEY);
        return;
      }

      globalThis.localStorage?.setItem(ExpenseService.BILL_STORAGE_KEY, billId);
    } catch {
      // Ignore storage unavailability.
    }
  }

  getBillMembers(group: Group | null, currentBill: Bill | null): GroupMember[] {
    if (!group || !currentBill) {
      return [];
    }

    if (group.members.length <= 2) {
      return group.members;
    }

    const participantIds = new Set<string>();
    const ownerMember = group.members.find((member) => member.profileId === currentBill.createdByProfileId)
      ?? group.members.find((member) => member.role === 'owner')
      ?? group.members[0];
    if (ownerMember) {
      participantIds.add(ownerMember.id);
    }

    if (currentBill.friendMemberId) {
      participantIds.add(currentBill.friendMemberId);
    }

    const scopedMembers = group.members.filter((member) => participantIds.has(member.id));
    if (scopedMembers.length > 0) {
      return scopedMembers;
    }

    return group.members;
  }

  private resolveBalanceMembers(group: Group, currentBill: Bill | null, expenses: Expense[]): Group['members'] {
    const billMembers = this.getBillMembers(group, currentBill);
    if (billMembers.length === 2) {
      return billMembers;
    }

    const participantIds = new Set<string>(billMembers.map((member) => member.id));

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

  private isBillAccessibleToUser(group: Group, userId: string | null, bill: Bill): boolean {
    if (!userId) {
      return false;
    }

    if (bill.createdByProfileId === userId) {
      return true;
    }

    const meMember = group.members.find((member) => member.profileId === userId);
    if (!meMember) {
      return false;
    }

    if (bill.friendMemberId) {
      return bill.friendMemberId === meMember.id || meMember.role === 'owner';
    }

    return meMember.role === 'owner';
  }
}

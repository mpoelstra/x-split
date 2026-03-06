import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { Bill, Group } from '../../core/models/domain.models';
import { BillStatsSnapshot, buildBillStats } from '../../core/utils/bill-stats';

@Injectable({ providedIn: 'root' })
export class BillStatsService {
  private readonly expenseService = inject(ExpenseService);

  readonly group = toSignal(
    this.expenseService.getCurrentGroup().pipe(catchError(() => of<Group | null>(null))),
    { initialValue: null }
  );
  readonly currentBill = toSignal(
    this.expenseService.getCurrentBill().pipe(catchError(() => of<Bill | null>(null))),
    { initialValue: null }
  );
  readonly expenses = toSignal(
    this.expenseService.getExpenses().pipe(catchError(() => of([]))),
    { initialValue: [] }
  );
  readonly stats = computed<BillStatsSnapshot>(() => buildBillStats(this.expenses(), this.group()?.members ?? []));
}

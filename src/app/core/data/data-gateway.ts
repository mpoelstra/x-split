import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  BalanceSummary,
  Bill,
  CreateBillInput,
  CreateExpenseInput,
  Expense,
  Group
} from '../models/domain.models';

export interface IDataGateway {
  getCurrentGroup(): Observable<Group>;
  getBills(): Observable<Bill[]>;
  createBill(input: CreateBillInput): Observable<Bill>;
  getCurrentBill(): Observable<Bill | null>;
  setCurrentBill(billId: string): Observable<Bill>;
  ensurePendingInviteMember(billId: string): Observable<string>;
  getExpenses(): Observable<Expense[]>;
  createExpense(input: CreateExpenseInput): Observable<Expense>;
  deleteExpense(expenseId: string): Observable<void>;
  getBalances(): Observable<BalanceSummary[]>;
  adminResetData(): Observable<void>;
}

export const DATA_GATEWAY = new InjectionToken<IDataGateway>('DATA_GATEWAY');

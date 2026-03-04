import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Bill,
  CreateBillInput,
  CreateExpenseInput,
  Expense,
  Group,
  UpdateExpenseInput
} from '../models/domain.models';

export interface IDataGateway {
  getCurrentGroup(): Observable<Group>;
  getBills(): Observable<Bill[]>;
  createBill(input: CreateBillInput): Observable<Bill>;
  deleteBill(billId: string): Observable<void>;
  getCurrentBill(): Observable<Bill | null>;
  setCurrentBill(billId: string): Observable<Bill>;
  ensurePendingInviteMember(billId: string): Observable<string>;
  getExpenses(): Observable<Expense[]>;
  getExpenseById(expenseId: string): Observable<Expense>;
  createExpense(input: CreateExpenseInput): Observable<Expense>;
  updateExpense(expenseId: string, input: UpdateExpenseInput): Observable<Expense>;
  deleteExpense(expenseId: string): Observable<void>;
  adminResetData(): Observable<void>;
}

export const DATA_GATEWAY = new InjectionToken<IDataGateway>('DATA_GATEWAY');

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import {
  Bill,
  CreateBillInput,
  CreateExpenseInput,
  Expense,
  Group,
  UpdateExpenseInput
} from '../models/domain.models';
import { IDataGateway } from './data-gateway';

@Injectable()
export class StubDataGateway implements IDataGateway {
  private readonly http = inject(HttpClient);

  getCurrentGroup(): Observable<Group> {
    return this.http.get<Group>('/api/groups/current');
  }

  getBills(): Observable<Bill[]> {
    return this.http.get<Bill[]>('/api/bills');
  }

  createBill(input: CreateBillInput): Observable<Bill> {
    return this.http.post<Bill>('/api/bills', input);
  }

  deleteBill(billId: string): Observable<void> {
    return this.http.delete<void>(`/api/bills/${billId}`);
  }

  getCurrentBill(): Observable<Bill | null> {
    return this.http.get<Bill | null>('/api/bills/current');
  }

  setCurrentBill(billId: string): Observable<Bill> {
    return this.http.post<Bill>('/api/bills/current', { billId });
  }

  ensurePendingInviteMember(billId: string): Observable<string> {
    return this.getBills().pipe(
      map((bills) => bills.find((bill) => bill.id === billId)),
      switchMap((bill) => {
        if (!bill) {
          throw new Error('Bill not found');
        }

        if (bill.friendMemberId) {
          return [bill.friendMemberId];
        }

        throw new Error('No pending invite member in stub mode');
      })
    );
  }

  getExpenses(): Observable<Expense[]> {
    return this.http.get<Expense[]>('/api/expenses');
  }

  getExpenseById(expenseId: string): Observable<Expense> {
    return this.http.get<Expense>(`/api/expenses/${expenseId}`);
  }

  createExpense(input: CreateExpenseInput): Observable<Expense> {
    return this.http.post<Expense>('/api/expenses', input);
  }

  updateExpense(expenseId: string, input: UpdateExpenseInput): Observable<Expense> {
    return this.http.put<Expense>(`/api/expenses/${expenseId}`, input);
  }

  deleteExpense(expenseId: string): Observable<void> {
    return this.http.delete<void>(`/api/expenses/${expenseId}`);
  }

  adminResetData(): Observable<void> {
    return this.http.post<void>('/api/admin/reset-data', {});
  }
}

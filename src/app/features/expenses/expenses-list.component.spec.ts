import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { ExpensesListComponent } from './expenses-list.component';

describe('ExpensesListComponent', () => {
  let component: ExpensesListComponent;
  let userSignal: ReturnType<typeof signal>;

  beforeEach(async () => {
    userSignal = signal({
      id: 'u1',
      displayName: 'Mark Poelstra',
      email: 'mark@example.com'
    });

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: ExpenseService,
          useValue: {
            getCurrentGroup: () =>
              of({
                id: 'g1',
                name: 'X-Split',
                members: [
                  { id: 'm1', profileId: 'u1', displayName: 'Mark Poelstra', role: 'owner' },
                  { id: 'm2', profileId: 'u2', displayName: 'Lucas Poelstra', role: 'member' },
                  { id: 'm3', profileId: 'u3', displayName: 'Richard Booij', role: 'member' }
                ]
              }),
            getCurrentBill: () =>
              of({
                id: 'b1',
                groupId: 'g1',
                title: 'Shared Xbox Games - richardbooy',
                friendMemberId: 'm3',
                friendName: 'richardbooy',
                createdAt: '2026-03-04T00:00:00Z'
              }),
            getExpenses: () =>
              of([
                {
                  id: 'e1',
                  groupId: 'g1',
                  billId: 'b1',
                  gameTitle: 'Curse of the Sea Rats',
                  amount: 9.99,
                  currency: 'EUR',
                  paidByMemberId: 'm1',
                  netToPayer: 4.99,
                  expenseDate: '2026-02-28',
                  source: 'csv_import',
                  createdAt: '2026-03-04T00:00:00Z'
                }
              ]),
            deleteExpense: () => of(void 0)
          }
        },
        {
          provide: AuthService,
          useValue: {
            user: userSignal
          }
        }
      ]
    });

    component = TestBed.runInInjectionContext(() => new ExpensesListComponent());
  });

  it('uses current bill friend for loaned label, not another group member', () => {
    const expense = component.expenses()[0];

    expect(component.loanedLabel(expense)).toBe('You loaned Richard');
  });

  it('allows delete/edit for friend member on the current bill', () => {
    userSignal.set({
      id: 'u3',
      displayName: 'Richard Booij',
      email: 'richardbooy@gmail.com'
    });
    const expense = component.expenses()[0];

    expect(component.canDelete(expense)).toBeTrue();
  });

  it('disallows delete/edit for group members not part of the current bill', () => {
    userSignal.set({
      id: 'u2',
      displayName: 'Lucas Poelstra',
      email: 'lucas@example.com'
    });
    const expense = component.expenses()[0];

    expect(component.canDelete(expense)).toBeFalse();
  });
});

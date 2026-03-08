import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { ExpensesListComponent } from './expenses-list.component';

describe('ExpensesListComponent', () => {
  let component: ExpensesListComponent;
  let userSignal: ReturnType<typeof signal>;
  const billMembers = [
    { id: 'm1', profileId: 'u1', displayName: 'Mark Poelstra', role: 'owner' as const },
    { id: 'm3', profileId: 'u3', displayName: 'Richard Booij', role: 'member' as const }
  ];

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
                  billMembers[0],
                  { id: 'm2', profileId: 'u2', displayName: 'Lucas Poelstra', role: 'member' },
                  billMembers[1]
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
            deleteExpense: () => of(void 0),
            getBillMembers: () => billMembers
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

  it('uses current bill member count for fallback split calculations', () => {
    const amount = component.loanedAmount({
      id: 'e-fallback',
      groupId: 'g1',
      billId: 'b1',
      gameTitle: 'Fallback Split',
      amount: 10,
      currency: 'EUR',
      paidByMemberId: 'm1',
      expenseDate: '2026-03-05',
      source: 'manual',
      createdAt: '2026-03-05T11:30:00Z'
    });

    expect(amount).toBe(5);
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

  it('sorts newest-first by createdAt when expenses share the same expense date', () => {
    component.expenses.set([
      {
        id: 'e-old',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Older on same day',
        amount: 9,
        currency: 'EUR',
        paidByMemberId: 'm1',
        expenseDate: '2026-03-05',
        source: 'manual',
        createdAt: '2026-03-05T09:00:00Z'
      },
      {
        id: 'e-new',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Newest on same day',
        amount: 10,
        currency: 'EUR',
        paidByMemberId: 'm1',
        expenseDate: '2026-03-05',
        source: 'manual',
        createdAt: '2026-03-05T11:30:00Z'
      }
    ]);

    const orderedIds = component.filteredExpenses().map((expense) => expense.id);
    expect(orderedIds).toEqual(['e-new', 'e-old']);
  });
});

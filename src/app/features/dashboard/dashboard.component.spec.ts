import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject, of } from 'rxjs';
import { APP_ENV } from '../../core/env/app-env.token';
import { AuthService } from '../../core/auth/auth.service';
import { ExpenseService } from '../../core/data/expense.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent (class-only)', () => {
  it('derives user balance and payer mapping from service streams', () => {
    const userSignal = signal({
      id: 'u1',
      displayName: 'Mark Poelstra',
      email: 'mark@example.com'
    });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: userSignal.asReadonly()
          }
        },
        {
          provide: APP_ENV,
          useValue: {
            mode: 'stub'
          }
        },
        {
          provide: ExpenseService,
          useValue: {
            getCurrentGroup: () =>
              of({
                id: 'g1',
                name: 'X-Split',
                members: [
                  { id: 'm1', profileId: 'u1', displayName: 'Mark Poelstra', role: 'owner' },
                  { id: 'm2', profileId: 'u2', displayName: 'Andrea', role: 'member' }
                ]
              }),
            getCurrentBill: () =>
              of({
                id: 'b1',
                groupId: 'g1',
                title: 'Xbox Games',
                friendName: 'Andrea',
                friendMemberId: 'm2',
                createdAt: '2026-03-01T00:00:00Z'
              }),
            getExpenses: () =>
              of([
                {
                  id: 'e1',
                  groupId: 'g1',
                  billId: 'b1',
                  gameTitle: 'Dead Island',
                  amount: 10,
                  currency: 'EUR',
                  paidByMemberId: 'm1',
                  netToPayer: 5,
                  expenseDate: '2026-03-01',
                  source: 'manual',
                  createdAt: '2026-03-01T00:00:00Z'
                },
                {
                  id: 'e2',
                  groupId: 'g1',
                  billId: 'b1',
                  gameTitle: 'Forza Horizon',
                  amount: 6,
                  currency: 'EUR',
                  paidByMemberId: 'm2',
                  netToPayer: 3,
                  expenseDate: '2026-03-02',
                  source: 'manual',
                  createdAt: '2026-03-02T00:00:00Z'
                }
              ]),
            getBalances: () =>
              of([
                { memberId: 'm1', displayName: 'Mark Poelstra', paidTotal: 10, shareTotal: 8, balance: 2 },
                { memberId: 'm2', displayName: 'Andrea', paidTotal: 6, shareTotal: 8, balance: -2 }
              ]),
            adminResetData: () => of(undefined)
          }
        }
      ]
    });

    globalThis.localStorage?.setItem('xsplit:activity-seen:u1:b1', '2026-03-02T00:00:00Z');

    const component = TestBed.runInInjectionContext(() => new DashboardComponent());

    expect(component.totalExpenses()).toBe(16);
    expect(component.myBalance()).toBe(2);
    expect(component.payerName('m2')).toBe('Andrea');
    expect(component.billCounterpartyName({
      id: 'b1',
      groupId: 'g1',
      title: 'Xbox Games',
      friendName: 'Andrea',
      friendMemberId: 'm2',
      createdAt: '2026-03-01T00:00:00Z'
    })).toBe('Andrea');
    expect(component.paidByCurrentUser({
      id: 'x',
      groupId: 'g1',
      billId: 'b1',
      gameTitle: 'Sample',
      amount: 1,
      currency: 'EUR',
      paidByMemberId: 'm1',
      expenseDate: '2026-03-03',
      source: 'manual',
      createdAt: '2026-03-03T00:00:00Z'
    })).toBeTrue();

    userSignal.set({
      id: 'u2',
      displayName: 'Lucas Poelstra',
      email: 'l.poelstra4@gmail.com'
    });
    expect(component.billCounterpartyName({
      id: 'b1',
      groupId: 'g1',
      title: 'Xbox Games',
      friendName: 'l.poelstra4',
      friendMemberId: 'm2',
      createdAt: '2026-03-01T00:00:00Z'
    })).toBe('Mark Poelstra');
  });

  it('shows unread expenses from other members since last visit and clears after mark as read', () => {
    globalThis.localStorage?.clear();

    const userSignal = signal({
      id: 'u1',
      displayName: 'Mark Poelstra',
      email: 'mark@example.com'
    });
    const expenses$ = new BehaviorSubject([
      {
        id: 'e1',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Dead Island',
        amount: 10,
        currency: 'EUR',
        paidByMemberId: 'm1',
        netToPayer: 5,
        expenseDate: '2026-03-01',
        source: 'manual' as const,
        createdByProfileId: 'u1',
        createdAt: '2026-03-01T00:00:00Z'
      },
      {
        id: 'e2',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Forza Horizon',
        amount: 6,
        currency: 'EUR',
        paidByMemberId: 'm2',
        netToPayer: 3,
        expenseDate: '2026-03-02',
        source: 'manual' as const,
        createdByProfileId: 'u2',
        createdAt: '2026-03-02T00:00:00Z'
      },
    ]);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            user: userSignal.asReadonly()
          }
        },
        {
          provide: APP_ENV,
          useValue: {
            mode: 'stub'
          }
        },
        {
          provide: ExpenseService,
          useValue: {
            getCurrentGroup: () =>
              of({
                id: 'g1',
                name: 'X-Split',
                members: [
                  { id: 'm1', profileId: 'u1', displayName: 'Mark Poelstra', role: 'owner' },
                  { id: 'm2', profileId: 'u2', displayName: 'Richard Booij', role: 'member' }
                ]
              }),
            getCurrentBill: () =>
              of({
                id: 'b1',
                groupId: 'g1',
                title: 'Xbox Games',
                friendName: 'Richard Booij',
                friendMemberId: 'm2',
                createdAt: '2026-03-01T00:00:00Z'
              }),
            getExpenses: () => expenses$.asObservable(),
            getBalances: () =>
              of([
                { memberId: 'm1', displayName: 'Mark Poelstra', paidTotal: 10, shareTotal: 8, balance: 2 },
                { memberId: 'm2', displayName: 'Richard Booij', paidTotal: 6, shareTotal: 8, balance: -2 }
              ]),
            adminResetData: () => of(undefined)
          }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new DashboardComponent());
    expect(component.unreadExpenseCount()).toBe(0);

    component.markActivityAsRead();

    expenses$.next([
      ...expenses$.value,
      {
        id: 'e3',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Halo Infinite',
        amount: 12,
        currency: 'EUR',
        paidByMemberId: 'm2',
        netToPayer: 6,
        expenseDate: '2026-03-03',
        source: 'manual',
        createdByProfileId: 'u2',
        createdAt: '2026-03-03T00:00:00Z'
      }
    ]);

    expect(component.unreadExpenseCount()).toBe(1);
    expect(component.isUnreadExpense(expenses$.value[2])).toBeTrue();

    component.markActivityAsRead();

    expect(component.unreadExpenseCount()).toBe(0);
    expect(component.isUnreadExpense(expenses$.value[2])).toBeFalse();
  });
});

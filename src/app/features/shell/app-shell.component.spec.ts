import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ExpenseService } from '../../core/data/expense.service';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent (class-only)', () => {
  const authServiceMock = {
    user: signal({
      id: 'u1',
      displayName: 'Mark Poelstra',
      email: 'mark@example.com'
    }).asReadonly()
  };

  const baseExpenseServiceMock = {
    getCurrentGroup: () =>
      of({
        id: 'g1',
        name: 'X-Split',
        members: [
          { id: 'm1', profileId: 'u1', displayName: 'Mark Poelstra', role: 'owner' },
          { id: 'm2', profileId: 'u2', displayName: 'Andrea', role: 'member' }
        ]
      }),
    getBills: () =>
      of([
        {
          id: 'b1',
          groupId: 'g1',
          title: 'Xbox Games',
          friendName: 'Andrea',
          createdAt: '2026-03-01T00:00:00Z'
        }
      ]),
    getCurrentBill: () =>
      of({
        id: 'b1',
        groupId: 'g1',
        title: 'Xbox Games',
        friendName: 'Andrea',
        createdAt: '2026-03-01T00:00:00Z'
      }),
    getBalances: () =>
      of([
        { memberId: 'm1', displayName: 'Mark Poelstra', paidTotal: 10, shareTotal: 8, balance: 2 },
        { memberId: 'm2', displayName: 'Andrea', paidTotal: 6, shareTotal: 8, balance: -2 }
      ]),
    setCurrentBill: () =>
      of({
        id: 'b1',
        groupId: 'g1',
        title: 'Xbox Games',
        friendName: 'Andrea',
        createdAt: '2026-03-01T00:00:00Z'
      })
  };

  it('computes bill tone/amount from balances', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: ExpenseService, useValue: baseExpenseServiceMock }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new AppShellComponent());

    expect(component.currentBalance()).toBe(2);
    expect(component.billTone()).toBe('owed');
    expect(component.billAmount()).toBe(2);
    expect(component.billOptionLabel({
      id: 'b1',
      groupId: 'g1',
      title: 'Xbox Games',
      friendName: 'Andrea',
      friendMemberId: 'm2',
      createdAt: '2026-03-01T00:00:00Z'
    })).toBe('Xbox Games - Andrea');
    expect(component.hasLoadError()).toBeFalse();
  });

  it('sets explicit load error state when balances stream fails', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: ExpenseService,
          useValue: {
            ...baseExpenseServiceMock,
            getBalances: () => throwError(() => new Error('balances failed'))
          }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new AppShellComponent());

    expect(component.balancesLoadError()).toBeTrue();
    expect(component.hasLoadError()).toBeTrue();
    expect(component.balances()).toEqual([]);
  });
});

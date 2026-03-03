import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ExpenseService } from '../../core/data/expense.service';
import { BillsComponent } from './bills.component';

describe('BillsComponent (class-only)', () => {
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
          { id: 'm1', profileId: 'u1', displayName: 'Mark Poelstra', email: 'm.poelstra@gmail.com', role: 'owner' },
          { id: 'm2', profileId: 'u2', displayName: 'Andrea', email: 'andrea@example.com', role: 'member' }
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
      }),
    createBill: () =>
      of({
        id: 'b2',
        groupId: 'g1',
        title: 'New Bill',
        friendName: 'Andrea',
        createdAt: '2026-03-01T00:00:00Z'
      })
  };

  it('computes friend options and current bill status', () => {
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: AuthService, useValue: authServiceMock },
        { provide: ExpenseService, useValue: baseExpenseServiceMock },
        {
          provide: Router,
          useValue: { navigateByUrl: () => Promise.resolve(true) }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new BillsComponent());

    expect(component.friendOptions().length).toBe(1);
    const status = component.statusFor('b1');
    expect(status?.tone).toBe('owed');
    expect(status?.amount).toBe(2);
    expect(component.hasLoadError()).toBeFalse();
  });

  it('sets explicit load error state when a stream fails', () => {
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: ExpenseService,
          useValue: {
            ...baseExpenseServiceMock,
            getBills: () => throwError(() => new Error('bills failed'))
          }
        },
        {
          provide: Router,
          useValue: { navigateByUrl: () => Promise.resolve(true) }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new BillsComponent());

    expect(component.billsLoadError()).toBeTrue();
    expect(component.hasLoadError()).toBeTrue();
    expect(component.bills()).toEqual([]);
  });

  it('shows owner as counterparty when logged-in user is the friend member', () => {
    TestBed.configureTestingModule({
      providers: [
        FormBuilder,
        {
          provide: AuthService,
          useValue: {
            user: signal({
              id: 'u2',
              displayName: 'Lucas Poelstra',
              email: 'l.poelstra4@gmail.com'
            }).asReadonly()
          }
        },
        {
          provide: ExpenseService,
          useValue: {
            ...baseExpenseServiceMock,
            getCurrentBill: () =>
              of({
                id: 'b1',
                groupId: 'g1',
                title: 'Xbox Games',
                friendName: 'l.poelstra4',
                friendMemberId: 'm2',
                inviteEmail: 'l.poelstra4@gmail.com',
                createdAt: '2026-03-01T00:00:00Z'
              })
          }
        },
        {
          provide: Router,
          useValue: { navigateByUrl: () => Promise.resolve(true) }
        }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new BillsComponent());
    const shared = component.sharedWith({
      id: 'b1',
      groupId: 'g1',
      title: 'Xbox Games',
      friendName: 'l.poelstra4',
      friendMemberId: 'm2',
      inviteEmail: 'l.poelstra4@gmail.com',
      createdAt: '2026-03-01T00:00:00Z'
    });

    expect(shared.name).toBe('Mark Poelstra');
    expect(shared.email).toBe('m.poelstra@gmail.com');
  });
});

import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DATA_GATEWAY } from './data-gateway';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  it('delegates to configured gateway', (done) => {
    const gateway = {
      getCurrentGroup: () => of({ id: 'g1', name: 'X-Split', members: [] }),
      getBills: () => of([]),
      createBill: () =>
        of({
          id: 'b1',
          groupId: 'g1',
          title: 'Xbox Games',
          friendName: 'Richard',
          createdAt: '2026-03-01T00:00:00Z'
        }),
      getCurrentBill: () =>
        of({
          id: 'b1',
          groupId: 'g1',
          title: 'Xbox Games',
          friendName: 'Richard',
          createdAt: '2026-03-01T00:00:00Z'
        }),
      setCurrentBill: () =>
        of({
          id: 'b1',
          groupId: 'g1',
          title: 'Xbox Games',
          friendName: 'Richard',
          createdAt: '2026-03-01T00:00:00Z'
        }),
      getExpenses: () => of([]),
      createExpense: () =>
        of({
          id: 'exp',
          groupId: 'g1',
          billId: 'b1',
          gameTitle: 'Halo',
          amount: 10,
          currency: 'EUR',
          paidByMemberId: 'm1',
          expenseDate: '2026-03-01',
          source: 'manual',
          createdAt: '2026-03-01T00:00:00Z'
        }),
      deleteExpense: () => of(undefined),
      getBalances: () => of([])
    };

    TestBed.configureTestingModule({
      providers: [
        ExpenseService,
        {
          provide: DATA_GATEWAY,
          useValue: gateway
        }
      ]
    });

    const service = TestBed.inject(ExpenseService);
    service.getCurrentGroup().subscribe((group) => {
      expect(group.name).toBe('X-Split');
      done();
    });
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { combineLatest, firstValueFrom, of, take } from 'rxjs';
import {
  Bill,
  CreateBillInput,
  CreateExpenseInput,
  Expense,
  Group,
  UpdateExpenseInput
} from '../models/domain.models';
import { AuthService } from '../auth/auth.service';
import { DATA_GATEWAY, IDataGateway } from './data-gateway';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  const billStorageKey = 'xsplit:selected-bill-id';
  const group: Group = {
    id: 'g1',
    name: 'X-Split',
    members: [
      { id: 'm1', profileId: 'u1', displayName: 'Mark', role: 'owner' },
      { id: 'm2', profileId: 'u2', displayName: 'Andrea', role: 'member' }
    ]
  };

  const bill: Bill = {
    id: 'b1',
    groupId: 'g1',
    title: 'Xbox Games',
    friendName: 'Andrea',
    friendMemberId: 'm2',
    createdAt: '2026-03-01T00:00:00Z'
  };

  const expense: Expense = {
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
  };

  const createGatewaySpy = (): jasmine.SpyObj<IDataGateway> => {
    const gateway = jasmine.createSpyObj<IDataGateway>('IDataGateway', [
      'getCurrentGroup',
      'getBills',
      'createBill',
      'deleteBill',
      'getCurrentBill',
      'setCurrentBill',
      'ensurePendingInviteMember',
      'getExpenses',
      'getExpenseById',
      'createExpense',
      'updateExpense',
      'deleteExpense',
      'adminResetData'
    ]);

    gateway.getCurrentGroup.and.returnValue(of(group));
    gateway.getBills.and.returnValue(of([bill]));
    gateway.createBill.and.callFake((input: CreateBillInput) =>
      of({
        ...bill,
        id: 'b-created',
        title: input.title
      })
    );
    gateway.deleteBill.and.returnValue(of(undefined));
    gateway.getCurrentBill.and.returnValue(of(bill));
    gateway.setCurrentBill.and.returnValue(of(bill));
    gateway.ensurePendingInviteMember.and.returnValue(of('m2'));
    gateway.getExpenses.and.returnValue(of([expense]));
    gateway.getExpenseById.and.returnValue(of(expense));
    gateway.createExpense.and.callFake((input: CreateExpenseInput) =>
      of({
        ...expense,
        id: 'e-created',
        ...input
      })
    );
    gateway.updateExpense.and.callFake((expenseId: string, input: UpdateExpenseInput) =>
      of({
        ...expense,
        id: expenseId,
        ...input
      })
    );
    gateway.deleteExpense.and.returnValue(of(undefined));
    gateway.adminResetData.and.returnValue(of(undefined));

    return gateway;
  };

  beforeEach(() => {
    localStorage.removeItem(billStorageKey);
  });

  const provideService = (gateway: IDataGateway, userId = 'u1') => {
    TestBed.configureTestingModule({
      providers: [
        ExpenseService,
        { provide: DATA_GATEWAY, useValue: gateway },
        {
          provide: AuthService,
          useValue: {
            user: signal({ id: userId, displayName: 'Test User', email: 'test@example.com' }).asReadonly()
          }
        }
      ]
    });

    return TestBed.inject(ExpenseService);
  };

  it('delegates and returns current group', (done) => {
    const gateway = createGatewaySpy();
    const service = provideService(gateway);
    service.getCurrentGroup().subscribe((result) => {
      expect(result.name).toBe('X-Split');
      expect(gateway.getCurrentGroup).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('does not duplicate bootstrap reads across concurrent stream subscriptions', async () => {
    const gateway = createGatewaySpy();
    const service = provideService(gateway);

    await firstValueFrom(
      combineLatest([
        service.getCurrentGroup(),
        service.getBills(),
        service.getCurrentBill(),
        service.getExpenses(),
        service.getBalances()
      ]).pipe(take(1))
    );

    expect(gateway.getCurrentGroup).toHaveBeenCalledTimes(1);
    expect(gateway.getBills).toHaveBeenCalledTimes(1);
    expect(gateway.getExpenses).toHaveBeenCalledTimes(1);
  });

  it('calculates balances using current bill participants when group has extra members', async () => {
    const groupWithExtraMember: Group = {
      ...group,
      members: [
        ...group.members,
        { id: 'm3', profileId: 'u3', displayName: 'Lars', role: 'member' }
      ]
    };

    const importLikeExpenses: Expense[] = [
      {
        ...expense,
        id: 'e-richard',
        amount: 100,
        paidByMemberId: 'm2',
        netToPayer: 50
      },
      {
        ...expense,
        id: 'e-mark',
        amount: 61.3,
        paidByMemberId: 'm1',
        netToPayer: 30.65
      }
    ];

    const gateway = createGatewaySpy();
    gateway.getCurrentGroup.and.returnValue(of(groupWithExtraMember));
    gateway.getExpenses.and.returnValue(of(importLikeExpenses));
    const service = provideService(gateway);
    const balances = await firstValueFrom(service.getBalances().pipe(take(1)));

    const markBalance = balances.find((entry) => entry.memberId === 'm1')?.balance;
    const richardBalance = balances.find((entry) => entry.memberId === 'm2')?.balance;
    const extraMemberBalance = balances.find((entry) => entry.memberId === 'm3');

    expect(markBalance).toBe(-19.35);
    expect(richardBalance).toBe(19.35);
    expect(extraMemberBalance).toBeUndefined();
  });

  it('returns only members linked to the current bill when group has extra members', () => {
    const gateway = createGatewaySpy();
    const service = provideService(gateway);
    const members = service.getBillMembers(
      {
        ...group,
        members: [
          ...group.members,
          { id: 'm3', profileId: 'u3', displayName: 'Lars', role: 'member' }
        ]
      },
      {
        ...bill,
        createdByProfileId: 'u1'
      }
    );

    expect(members.map((member) => member.id)).toEqual(['m1', 'm2']);
  });

  it('filters out bills that are not shared with the current user', async () => {
    const gateway = createGatewaySpy();
    gateway.getCurrentGroup.and.returnValue(of({
      ...group,
      members: [
        { id: 'm1', profileId: 'u1', displayName: 'Mark', role: 'owner' },
        { id: 'm2', profileId: 'u2', displayName: 'Lucas', role: 'member' },
        { id: 'm3', profileId: 'u3', displayName: 'Richard', role: 'member' }
      ]
    }));
    gateway.getBills.and.returnValue(of([
      {
        id: 'b-lucas',
        groupId: 'g1',
        title: 'test',
        createdByProfileId: 'u1',
        friendName: 'Lucas',
        friendMemberId: 'm2',
        createdAt: '2026-03-01T00:00:00Z'
      },
      {
        id: 'b-richard',
        groupId: 'g1',
        title: 'Shared Xbox Games',
        createdByProfileId: 'u1',
        friendName: 'Richard',
        friendMemberId: 'm3',
        createdAt: '2026-03-02T00:00:00Z'
      }
    ]));

    const service = provideService(gateway, 'u2');
    const bills = await firstValueFrom(service.getBills().pipe(take(1)));

    expect(bills.map((entry) => entry.id)).toEqual(['b-lucas']);
  });

  it('restores selected bill on reload and syncs gateway bill context', async () => {
    localStorage.setItem(billStorageKey, 'b2');
    const gateway = createGatewaySpy();
    gateway.getBills.and.returnValue(of([
      bill,
      {
        ...bill,
        id: 'b2',
        title: 'Playstation Games'
      }
    ]));
    gateway.setCurrentBill.and.callFake((billId: string) =>
      of({
        ...bill,
        id: billId,
        title: billId === 'b2' ? 'Playstation Games' : bill.title
      })
    );

    const service = provideService(gateway);
    const selected = await firstValueFrom(service.getCurrentBill().pipe(take(1)));
    await firstValueFrom(service.getExpenses().pipe(take(1)));

    expect(selected?.id).toBe('b2');
    expect(gateway.setCurrentBill).toHaveBeenCalledWith('b2');
  });
});

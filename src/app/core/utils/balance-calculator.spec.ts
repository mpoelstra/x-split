import { calculateBalances } from './balance-calculator';
import { Expense, GroupMember } from '../models/domain.models';

describe('calculateBalances', () => {
  const members: GroupMember[] = [
    { id: 'm1', profileId: 'u1', displayName: 'Mark', role: 'owner' },
    { id: 'm2', profileId: 'u2', displayName: 'Richard', role: 'member' }
  ];

  it('splits equally for a single expense', () => {
    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Halo Infinite',
        amount: 60,
        currency: 'EUR',
        paidByMemberId: 'm1',
        expenseDate: '2026-03-01',
        source: 'manual',
        createdAt: '2026-03-01T10:00:00Z'
      }
    ];

    const result = calculateBalances(expenses, members);

    expect(result.find((r) => r.memberId === 'm1')?.balance).toBe(30);
    expect(result.find((r) => r.memberId === 'm2')?.balance).toBe(-30);
  });

  it('handles mixed payer history', () => {
    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Halo Infinite',
        amount: 50,
        currency: 'EUR',
        paidByMemberId: 'm1',
        expenseDate: '2026-03-01',
        source: 'manual',
        createdAt: '2026-03-01T10:00:00Z'
      },
      {
        id: 'e2',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Forza',
        amount: 30,
        currency: 'EUR',
        paidByMemberId: 'm2',
        expenseDate: '2026-03-02',
        source: 'manual',
        createdAt: '2026-03-02T10:00:00Z'
      }
    ];

    const result = calculateBalances(expenses, members);

    expect(result.find((r) => r.memberId === 'm1')?.balance).toBe(10);
    expect(result.find((r) => r.memberId === 'm2')?.balance).toBe(-10);
  });

  it('rounds decimals to 2 digits', () => {
    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Odd price',
        amount: 59.99,
        currency: 'EUR',
        paidByMemberId: 'm1',
        expenseDate: '2026-03-01',
        source: 'manual',
        createdAt: '2026-03-01T10:00:00Z'
      }
    ];

    const result = calculateBalances(expenses, members);

    expect(result.find((r) => r.memberId === 'm1')?.balance).toBe(30);
    expect(result.find((r) => r.memberId === 'm2')?.balance).toBe(-29.99);
  });

  it('uses imported net-to-payer values for splitwise parity', () => {
    const expenses: Expense[] = [
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
        createdAt: '2026-02-28T10:00:00Z'
      }
    ];

    const result = calculateBalances(expenses, members);

    expect(result.find((r) => r.memberId === 'm1')?.balance).toBe(4.99);
    expect(result.find((r) => r.memberId === 'm2')?.balance).toBe(-4.99);
  });
});

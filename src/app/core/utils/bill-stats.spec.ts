import { Expense } from '../models/domain.models';
import { buildBillStats, looseTitleKey, strictTitleKey } from './bill-stats';

describe('bill-stats', () => {
  const members = [
    { id: 'm1', profileId: 'u1', displayName: 'Mark Poelstra', role: 'owner' as const },
    { id: 'm2', profileId: 'u2', displayName: 'Richard Booij', role: 'member' as const }
  ];

  it('groups punctuation-only title variants as duplicates', () => {
    const stats = buildBillStats(
      [
        expense({ id: 'e1', gameTitle: "Assassin's Creed Mirage", amount: 19.99, paidByMemberId: 'm1', expenseDate: '2026-03-01' }),
        expense({ id: 'e2', gameTitle: 'Assassins Creed Mirage', amount: 21.99, paidByMemberId: 'm2', expenseDate: '2026-03-02' })
      ],
      members
    );

    expect(strictTitleKey("Assassin's Creed Mirage")).toBe(strictTitleKey('Assassins Creed Mirage'));
    expect(stats.duplicateGroups.length).toBe(1);
    expect(stats.duplicateGroups[0]?.purchaseCount).toBe(2);
  });

  it('treats edition/platform variants as near duplicates', () => {
    const stats = buildBillStats(
      [
        expense({ id: 'e1', gameTitle: 'Resident Evil 4', amount: 39.99, paidByMemberId: 'm1', expenseDate: '2026-01-10' }),
        expense({ id: 'e2', gameTitle: 'Resident Evil 4 Gold Edition', amount: 49.99, paidByMemberId: 'm2', expenseDate: '2026-01-18' })
      ],
      members
    );

    expect(looseTitleKey('Resident Evil 4 Gold Edition')).toBe(looseTitleKey('Resident Evil 4'));
    expect(stats.nearDuplicateGroups.length).toBe(1);
    expect(stats.nearDuplicateGroups[0]?.variants.length).toBe(2);
  });

  it('calculates median price and weekly streak', () => {
    const stats = buildBillStats(
      [
        expense({ id: 'e1', gameTitle: 'Game One', amount: 5, paidByMemberId: 'm1', expenseDate: '2026-01-05' }),
        expense({ id: 'e2', gameTitle: 'Game Two', amount: 15, paidByMemberId: 'm1', expenseDate: '2026-01-12' }),
        expense({ id: 'e3', gameTitle: 'Game Three', amount: 45, paidByMemberId: 'm2', expenseDate: '2026-01-19' }),
        expense({ id: 'e4', gameTitle: 'Game Four', amount: 60, paidByMemberId: 'm2', expenseDate: '2026-02-10' })
      ],
      members
    );

    expect(stats.medianPrice).toBe(30);
    expect(stats.longestWeeklyStreak).toBe(3);
    expect(stats.bargainHunterScore).toBe(25);
    expect(stats.premiumTasteScore).toBe(25);
  });
});

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'expense-1',
    groupId: 'g1',
    billId: 'b1',
    gameTitle: 'Example Game',
    amount: 10,
    currency: 'EUR',
    paidByMemberId: 'm1',
    expenseDate: '2026-01-01',
    source: 'manual',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

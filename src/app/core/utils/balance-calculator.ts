import { BalanceSummary, Expense, GroupMember } from '../models/domain.models';

const round2 = (value: number): number => Math.round(value * 100) / 100;

export const calculateBalances = (
  expenses: Expense[],
  members: GroupMember[]
): BalanceSummary[] => {
  if (members.length === 0) {
    return [];
  }

  const map = new Map<string, BalanceSummary>(
    members.map((member) => [
      member.id,
      {
        memberId: member.id,
        displayName: member.displayName,
        paidTotal: 0,
        shareTotal: 0,
        balance: 0
      }
    ])
  );

  const applyNetAdjustment = (payerId: string, netToPayer: number): void => {
    const participantCount = members.length;
    if (participantCount <= 1) {
      return;
    }

    const perOther = round2(netToPayer / (participantCount - 1));
    for (const member of members) {
      const entry = map.get(member.id);
      if (!entry) {
        continue;
      }

      if (member.id === payerId) {
        entry.balance = round2(entry.balance + netToPayer);
      } else {
        entry.balance = round2(entry.balance - perOther);
      }
    }
  };

  const applyEqualSplitAdjustment = (expense: Expense): void => {
    const share = expense.amount / members.length;
    for (const member of members) {
      const entry = map.get(member.id);
      if (!entry) {
        continue;
      }

      if (member.id === expense.paidByMemberId) {
        entry.balance = round2(entry.balance + (expense.amount - share));
      } else {
        entry.balance = round2(entry.balance - share);
      }
    }
  };

  for (const expense of expenses) {
    const payerEntry = map.get(expense.paidByMemberId);
    if (payerEntry) {
      payerEntry.paidTotal = round2(payerEntry.paidTotal + expense.amount);
    }

    if (typeof expense.netToPayer === 'number' && Number.isFinite(expense.netToPayer)) {
      applyNetAdjustment(expense.paidByMemberId, round2(expense.netToPayer));
    } else {
      applyEqualSplitAdjustment(expense);
    }
  }

  for (const entry of map.values()) {
    entry.shareTotal = round2(entry.paidTotal - entry.balance);
  }

  return [...map.values()];
};

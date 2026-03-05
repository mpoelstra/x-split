import { Expense } from '../models/domain.models';

const toTimestamp = (value: string | undefined): number => {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const compareExpensesNewestFirst = (a: Expense, b: Expense): number => {
  const createdAtDiff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  const expenseDateDiff = toTimestamp(b.expenseDate) - toTimestamp(a.expenseDate);
  if (expenseDateDiff !== 0) {
    return expenseDateDiff;
  }

  return b.id.localeCompare(a.id);
};

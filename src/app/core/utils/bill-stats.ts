import { Expense, GroupMember } from '../models/domain.models';

export interface BillStatsSnapshot {
  currency: string;
  totalSpend: number;
  uniqueTitles: number;
  averagePrice: number;
  medianPrice: number;
  bargainHunterScore: number;
  premiumTasteScore: number;
  longestWeeklyStreak: number;
  summaryCardCount: number;
  duplicateCount: number;
  duplicateGroups: DuplicateGroup[];
  nearDuplicateGroups: NearDuplicateGroup[];
  mostExpensive: RankedExpenseEntry[];
  cheapest: RankedExpenseEntry[];
  biggestSpreeDays: SpreeDayEntry[];
  mostItemsDays: SpreeDayEntry[];
  titleLengthStats: TitleLengthStats;
  spendByPerson: PersonSpendEntry[];
  spendTimeline: TimelinePoint[];
}

export interface DuplicateGroup {
  label: string;
  normalizedTitle: string;
  purchaseCount: number;
  totalSpend: number;
  items: DuplicateItem[];
}

export interface NearDuplicateGroup {
  label: string;
  looseKey: string;
  purchaseCount: number;
  totalSpend: number;
  variants: NearDuplicateVariant[];
}

export interface DuplicateItem {
  id: string;
  title: string;
  trueAchievementsUrl?: string;
  amount: number;
  expenseDate: string;
  payerName: string;
}

export interface NearDuplicateVariant {
  label: string;
  trueAchievementsUrl?: string;
  purchaseCount: number;
  totalSpend: number;
}

export interface RankedExpenseEntry {
  id: string;
  title: string;
  trueAchievementsUrl?: string;
  amount: number;
  expenseDate: string;
  payerName: string;
}

export interface SpreeDayEntry {
  date: string;
  totalSpend: number;
  purchaseCount: number;
  titles: string[];
}

export interface PersonSpendEntry {
  memberId: string;
  name: string;
  totalSpend: number;
  purchaseCount: number;
  averagePrice: number;
}

export interface TimelinePoint {
  key: string;
  label: string;
  totalSpend: number;
  purchaseCount: number;
}

export interface TitleLengthStats {
  shortest: RankedExpenseEntry | null;
  longest: RankedExpenseEntry | null;
}

const LOOSE_TITLE_NOISE = new Set([
  'digital',
  'bundle',
  'pack',
  'edition',
  'deluxe',
  'ultimate',
  'complete',
  'definitive',
  'premium',
  'gold',
  'remastered',
  'anniversary',
  'collection',
  'upgrade',
  'xbox',
  'series',
  'one',
  'xs',
  'x',
  's',
  'goty'
]);

export function buildBillStats(expenses: Expense[], members: GroupMember[]): BillStatsSnapshot {
  const currency = expenses[0]?.currency ?? 'EUR';
  const amounts = expenses.map((expense) => expense.amount).sort((a, b) => a - b);
  const strictBuckets = groupBy(expenses, (expense) => strictTitleKey(expense.gameTitle));
  const nameMap = new Map(members.map((member) => [member.id, firstName(member.displayName)]));
  const duplicateGroups = buildDuplicateGroups(expenses, nameMap);
  const nearDuplicateGroups = buildNearDuplicateGroups(expenses);

  const spreeDays = buildSpreeDays(expenses);

  return {
    currency,
    totalSpend: sum(expenses.map((expense) => expense.amount)),
    uniqueTitles: strictBuckets.size,
    averagePrice: average(amounts),
    medianPrice: median(amounts),
    bargainHunterScore: percentage(expenses.filter((expense) => expense.amount <= 10).length, expenses.length),
    premiumTasteScore: percentage(expenses.filter((expense) => expense.amount > 50).length, expenses.length),
    longestWeeklyStreak: longestWeeklyStreak(expenses),
    summaryCardCount: expenses.length,
    duplicateCount: duplicateGroups.reduce((count, group) => count + group.purchaseCount, 0),
    duplicateGroups,
    nearDuplicateGroups,
    mostExpensive: [...expenses]
      .sort((a, b) => b.amount - a.amount || compareDateDesc(a.expenseDate, b.expenseDate))
      .slice(0, 5)
      .map((expense) => rankedExpenseEntry(expense, nameMap)),
    cheapest: [...expenses]
      .sort((a, b) => a.amount - b.amount || compareDateDesc(a.expenseDate, b.expenseDate))
      .slice(0, 5)
      .map((expense) => rankedExpenseEntry(expense, nameMap)),
    biggestSpreeDays: [...spreeDays]
      .sort((a, b) => b.totalSpend - a.totalSpend || b.purchaseCount - a.purchaseCount || compareDateDesc(a.date, b.date))
      .slice(0, 5),
    mostItemsDays: [...spreeDays]
      .sort((a, b) => b.purchaseCount - a.purchaseCount || b.totalSpend - a.totalSpend || compareDateDesc(a.date, b.date))
      .slice(0, 5),
    titleLengthStats: buildTitleLengthStats(expenses, nameMap),
    spendByPerson: buildSpendByPerson(expenses, members),
    spendTimeline: buildTimeline(expenses)
  };
}

export function strictTitleKey(title: string): string {
  return normalizeWhitespace(
    title
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
  );
}

export function looseTitleKey(title: string): string {
  const tokens = strictTitleKey(title)
    .split(' ')
    .filter((token) => token.length > 0 && !LOOSE_TITLE_NOISE.has(token));
  return normalizeWhitespace(tokens.join(' '));
}

function buildDuplicateGroups(expenses: Expense[], nameMap: Map<string, string>): DuplicateGroup[] {
  return [...groupBy(expenses, (expense) => strictTitleKey(expense.gameTitle)).entries()]
    .filter(([, items]) => items.length > 1)
    .map(([normalizedTitle, items]) => ({
      label: representativeTitle(items.map((item) => item.gameTitle)),
      normalizedTitle,
      purchaseCount: items.length,
      totalSpend: sum(items.map((item) => item.amount)),
      items: [...items]
        .sort((a, b) => compareDateDesc(a.expenseDate, b.expenseDate))
        .map((item) => ({
          id: item.id,
          title: item.gameTitle,
          trueAchievementsUrl: item.trueAchievementsUrl,
          amount: item.amount,
          expenseDate: item.expenseDate,
          payerName: nameMap.get(item.paidByMemberId) ?? 'Member'
        }))
    }))
    .sort((a, b) => b.purchaseCount - a.purchaseCount || b.totalSpend - a.totalSpend || a.label.localeCompare(b.label));
}

function buildNearDuplicateGroups(expenses: Expense[]): NearDuplicateGroup[] {
  return [...groupBy(expenses, (expense) => looseTitleKey(expense.gameTitle) || strictTitleKey(expense.gameTitle)).entries()]
    .map<NearDuplicateGroup | null>(([looseKey, items]) => {
      const variants = [...groupBy(items, (item) => strictTitleKey(item.gameTitle)).values()];
      if (variants.length < 2) {
        return null;
      }

      return {
        label: representativeTitle(items.map((item) => item.gameTitle)),
        looseKey,
        purchaseCount: items.length,
        totalSpend: sum(items.map((item) => item.amount)),
        variants: variants
          .map((variantItems) => ({
            label: representativeTitle(variantItems.map((item) => item.gameTitle)),
            trueAchievementsUrl: variantItems[0]?.trueAchievementsUrl,
            purchaseCount: variantItems.length,
            totalSpend: sum(variantItems.map((item) => item.amount))
          }))
          .sort((a, b) => b.purchaseCount - a.purchaseCount || b.totalSpend - a.totalSpend || a.label.localeCompare(b.label))
      };
    })
    .filter((group): group is NearDuplicateGroup => group !== null)
    .sort((a, b) => b.purchaseCount - a.purchaseCount || b.totalSpend - a.totalSpend || a.label.localeCompare(b.label));
}

function buildSpreeDays(expenses: Expense[]): SpreeDayEntry[] {
  return [...groupBy(expenses, (expense) => expense.expenseDate).entries()]
    .map(([date, items]) => ({
      date,
      totalSpend: sum(items.map((item) => item.amount)),
      purchaseCount: items.length,
      titles: [...new Set(items.map((item) => item.gameTitle))]
    }));
}

function buildSpendByPerson(expenses: Expense[], members: GroupMember[]): PersonSpendEntry[] {
  const grouped = groupBy(expenses, (expense) => expense.paidByMemberId);
  const nameMap = new Map(members.map((member) => [member.id, firstName(member.displayName)]));

  return [...grouped.entries()]
    .map(([memberId, items]) => ({
      memberId,
      name: nameMap.get(memberId) ?? 'Member',
      totalSpend: sum(items.map((item) => item.amount)),
      purchaseCount: items.length,
      averagePrice: average(items.map((item) => item.amount))
    }))
    .sort((a, b) => b.totalSpend - a.totalSpend || b.purchaseCount - a.purchaseCount || a.name.localeCompare(b.name));
}

function buildTimeline(expenses: Expense[]): TimelinePoint[] {
  return [...groupBy(expenses, (expense) => expense.expenseDate.slice(0, 7)).entries()]
    .map(([key, items]) => ({
      key,
      label: monthLabel(key),
      totalSpend: sum(items.map((item) => item.amount)),
      purchaseCount: items.length
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function rankedExpenseEntry(expense: Expense, nameMap: Map<string, string>): RankedExpenseEntry {
  return {
    id: expense.id,
    title: expense.gameTitle,
    trueAchievementsUrl: expense.trueAchievementsUrl,
    amount: expense.amount,
    expenseDate: expense.expenseDate,
    payerName: nameMap.get(expense.paidByMemberId) ?? 'Member'
  };
}

function buildTitleLengthStats(expenses: Expense[], nameMap: Map<string, string>): TitleLengthStats {
  if (expenses.length === 0) {
    return {
      shortest: null,
      longest: null
    };
  }

  const sorted = [...expenses].sort(
    (a, b) =>
      a.gameTitle.length - b.gameTitle.length ||
      a.gameTitle.localeCompare(b.gameTitle) ||
      compareDateDesc(a.expenseDate, b.expenseDate)
  );

  const shortest = sorted[0] ? rankedExpenseEntry(sorted[0], nameMap) : null;
  const longest = sorted[sorted.length - 1] ? rankedExpenseEntry(sorted[sorted.length - 1], nameMap) : null;

  return {
    shortest,
    longest
  };
}

function longestWeeklyStreak(expenses: Expense[]): number {
  const weekStarts = [...new Set(expenses.map((expense) => weekStartKey(expense.expenseDate)))]
    .map((date) => new Date(`${date}T00:00:00Z`).getTime())
    .sort((a, b) => a - b);

  if (weekStarts.length === 0) {
    return 0;
  }

  let best = 1;
  let current = 1;

  for (let index = 1; index < weekStarts.length; index += 1) {
    if (weekStarts[index] - weekStarts[index - 1] === 7 * 24 * 60 * 60 * 1000) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 1;
    }
  }

  return best;
}

function weekStartKey(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function representativeTitle(titles: string[]): string {
  return [...titles].sort((a, b) => a.length - b.length || a.localeCompare(b))[0] ?? 'Unknown';
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? 'Member';
}

function compareDateDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2;
  }

  return values[middle] ?? 0;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return sum(values) / values.length;
}

function percentage(value: number, total: number): number {
  if (total === 0) {
    return 0;
  }

  return (value / total) * 100;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
      continue;
    }
    groups.set(key, [item]);
  }

  return groups;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

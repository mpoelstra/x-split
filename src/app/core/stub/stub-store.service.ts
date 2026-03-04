import { Injectable } from '@angular/core';
import {
  Bill,
  CreateBillInput,
  Expense,
  Group,
  GroupMember,
  UpdateExpenseInput,
  UserProfile
} from '../models/domain.models';
import { trueAchievementsGameUrl } from '../utils/trueachievements-link';

@Injectable({ providedIn: 'root' })
export class StubStoreService {
  private readonly me: UserProfile = {
    id: 'user-mark',
    displayName: 'Mark Poelstra',
    email: 'mark@example.com'
  };

  private readonly members: GroupMember[] = [
    { id: 'member-mark', profileId: 'user-mark', displayName: 'Mark Poelstra', role: 'owner' },
    { id: 'member-richard', profileId: 'user-richard', displayName: 'Richard Booij', role: 'member' }
  ];

  private readonly group: Group = {
    id: 'group-xsplit',
    name: 'X-Split',
    members: this.members
  };

  private readonly seedBills: Bill[] = [
    {
      id: 'bill-xbox-games',
      groupId: 'group-xsplit',
      createdByProfileId: 'user-mark',
      title: 'Xbox Games',
      friendMemberId: 'member-richard',
      friendName: 'Richard Booij',
      createdAt: '2026-02-01T10:00:00Z'
    },
    {
      id: 'bill-game-pass',
      groupId: 'group-xsplit',
      createdByProfileId: 'user-mark',
      title: 'Game Pass + DLC',
      friendMemberId: 'member-richard',
      friendName: 'Richard Booij',
      createdAt: '2026-02-18T10:00:00Z'
    },
    {
      id: 'bill-coop-month',
      groupId: 'group-xsplit',
      createdByProfileId: 'user-mark',
      title: 'Co-op Month March',
      friendMemberId: 'member-richard',
      friendName: 'Richard Booij',
      createdAt: '2026-03-01T10:00:00Z'
    },
    {
      id: 'bill-remaster-drop',
      groupId: 'group-xsplit',
      createdByProfileId: 'user-mark',
      title: 'Remaster Drop',
      friendMemberId: 'member-richard',
      friendName: 'Richard Booij',
      createdAt: '2026-01-20T10:00:00Z'
    }
  ];

  private readonly seedExpenses: Expense[] = [
    {
      id: 'exp-1',
      groupId: 'group-xsplit',
      billId: 'bill-xbox-games',
      gameTitle: 'Halo 5',
      amount: 60,
      currency: 'EUR',
      paidByMemberId: 'member-mark',
      expenseDate: '2015-10-28',
      source: 'csv_import',
      category: 'Spelletjes',
      createdAt: '2015-10-28T10:00:00Z'
    },
    {
      id: 'exp-2',
      groupId: 'group-xsplit',
      billId: 'bill-xbox-games',
      gameTitle: 'Rise of the Tomb Raider',
      amount: 60,
      currency: 'EUR',
      paidByMemberId: 'member-richard',
      expenseDate: '2015-11-10',
      source: 'csv_import',
      category: 'Spelletjes',
      createdAt: '2015-11-10T10:00:00Z'
    },
    {
      id: 'exp-3',
      groupId: 'group-xsplit',
      billId: 'bill-xbox-games',
      gameTitle: 'Forza Horizon 5',
      amount: 14,
      currency: 'EUR',
      paidByMemberId: 'member-mark',
      expenseDate: '2026-02-27',
      source: 'manual',
      category: 'Spelletjes',
      createdAt: '2026-02-27T16:00:00Z'
    },
    {
      id: 'exp-4',
      groupId: 'group-xsplit',
      billId: 'bill-game-pass',
      gameTitle: 'Game Pass Ultimate',
      amount: 14.99,
      currency: 'EUR',
      paidByMemberId: 'member-mark',
      expenseDate: '2026-02-14',
      source: 'manual',
      category: 'Subscription',
      createdAt: '2026-02-14T12:30:00Z'
    },
    {
      id: 'exp-5',
      groupId: 'group-xsplit',
      billId: 'bill-game-pass',
      gameTitle: 'Forza Horizon 5 Rally Adventure',
      amount: 39.99,
      currency: 'EUR',
      paidByMemberId: 'member-richard',
      expenseDate: '2026-02-19',
      source: 'manual',
      category: 'DLC',
      createdAt: '2026-02-19T20:10:00Z'
    },
    {
      id: 'exp-6',
      groupId: 'group-xsplit',
      billId: 'bill-game-pass',
      gameTitle: 'Sea of Thieves - Season Pass',
      amount: 12.99,
      currency: 'EUR',
      paidByMemberId: 'member-richard',
      expenseDate: '2026-02-23',
      source: 'manual',
      category: 'Season Pass',
      createdAt: '2026-02-23T18:05:00Z'
    },
    {
      id: 'exp-7',
      groupId: 'group-xsplit',
      billId: 'bill-coop-month',
      gameTitle: 'It Takes Two',
      amount: 40,
      currency: 'EUR',
      paidByMemberId: 'member-richard',
      expenseDate: '2026-03-01',
      source: 'manual',
      category: 'Co-op',
      createdAt: '2026-03-01T09:15:00Z'
    },
    {
      id: 'exp-8',
      groupId: 'group-xsplit',
      billId: 'bill-coop-month',
      gameTitle: 'A Way Out',
      amount: 30,
      currency: 'EUR',
      paidByMemberId: 'member-mark',
      expenseDate: '2026-03-02',
      source: 'manual',
      category: 'Co-op',
      createdAt: '2026-03-02T13:45:00Z'
    },
    {
      id: 'exp-9',
      groupId: 'group-xsplit',
      billId: 'bill-coop-month',
      gameTitle: 'Overcooked! 2',
      amount: 10,
      currency: 'EUR',
      paidByMemberId: 'member-mark',
      expenseDate: '2026-03-03',
      source: 'manual',
      category: 'Co-op',
      createdAt: '2026-03-03T21:00:00Z'
    },
    {
      id: 'exp-10',
      groupId: 'group-xsplit',
      billId: 'bill-remaster-drop',
      gameTitle: 'Mass Effect Legendary Edition',
      amount: 34.99,
      currency: 'EUR',
      paidByMemberId: 'member-mark',
      expenseDate: '2026-01-22',
      source: 'manual',
      category: 'Remaster',
      createdAt: '2026-01-22T11:20:00Z'
    },
    {
      id: 'exp-11',
      groupId: 'group-xsplit',
      billId: 'bill-remaster-drop',
      gameTitle: 'Halo: MCC',
      amount: 9.99,
      currency: 'EUR',
      paidByMemberId: 'member-richard',
      expenseDate: '2026-01-28',
      source: 'manual',
      category: 'Remaster',
      createdAt: '2026-01-28T17:05:00Z'
    },
    {
      id: 'exp-12',
      groupId: 'group-xsplit',
      billId: 'bill-remaster-drop',
      gameTitle: 'Gears of War Ultimate Edition',
      amount: 24.99,
      currency: 'EUR',
      paidByMemberId: 'member-mark',
      expenseDate: '2026-01-30',
      source: 'manual',
      category: 'Remaster',
      createdAt: '2026-01-30T09:10:00Z'
    }
  ];

  private bills: Bill[] = [...this.seedBills];
  private expenses: Expense[] = [...this.seedExpenses];
  private activeBillId: string | null = this.seedBills[0]?.id ?? null;

  getMe(): UserProfile {
    return this.me;
  }

  getGroup(): Group {
    return this.group;
  }

  getBills(): Bill[] {
    return [...this.bills].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getActiveBill(): Bill | null {
    if (!this.activeBillId) {
      return null;
    }

    return this.bills.find((bill) => bill.id === this.activeBillId) ?? null;
  }

  setActiveBill(billId: string): Bill | null {
    const bill = this.bills.find((entry) => entry.id === billId) ?? null;
    if (!bill) {
      return null;
    }

    this.activeBillId = bill.id;
    return bill;
  }

  createBill(payload: CreateBillInput): Bill {
    const title = payload.title.trim();
    if (!title) {
      throw new Error('Bill title is required');
    }

    const friendFromMember = payload.friendMemberId
      ? this.members.find((member) => member.id === payload.friendMemberId)
      : undefined;
    const inviteEmail = payload.inviteEmail?.trim();

    if (!friendFromMember && !inviteEmail) {
      throw new Error('Select a friend or provide an invite email');
    }

    const friendName = friendFromMember?.displayName ?? payload.friendName?.trim() ?? 'Pending friend';

    const bill: Bill = {
      id: `bill-${this.bills.length + 1}`,
      groupId: this.group.id,
      createdByProfileId: this.me.id,
      title,
      friendMemberId: friendFromMember?.id,
      friendName,
      inviteEmail: inviteEmail || undefined,
      createdAt: new Date().toISOString()
    };

    this.bills = [bill, ...this.bills];
    this.activeBillId = bill.id;
    return bill;
  }

  getExpenses(): Expense[] {
    const activeBill = this.getActiveBill();
    if (!activeBill) {
      return [];
    }

    return [...this.expenses]
      .filter((expense) => expense.billId === activeBill.id)
      .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate));
  }

  getExpenseById(expenseId: string): Expense {
    const expense = this.expenses.find((entry) => entry.id === expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    return expense;
  }

  addExpense(payload: {
    gameTitle: string;
    trueAchievementsUrl?: string;
    amount: number;
    paidByMemberId: string;
    expenseDate: string;
    currency: string;
    category?: string;
    source?: 'manual' | 'csv_import';
  }): Expense {
    const activeBill = this.getActiveBill();
    if (!activeBill) {
      throw new Error('No active bill selected');
    }

    const newExpense: Expense = {
      id: `exp-${this.expenses.length + 1}`,
      groupId: this.group.id,
      billId: activeBill.id,
      createdByProfileId: this.me.id,
      gameTitle: payload.gameTitle,
      trueAchievementsUrl: payload.trueAchievementsUrl || trueAchievementsGameUrl(payload.gameTitle),
      amount: payload.amount,
      currency: payload.currency,
      paidByMemberId: payload.paidByMemberId,
      expenseDate: payload.expenseDate,
      category: payload.category,
      source: payload.source ?? 'manual',
      createdAt: new Date().toISOString()
    };

    this.expenses = [newExpense, ...this.expenses];
    return newExpense;
  }

  updateExpense(expenseId: string, payload: UpdateExpenseInput): Expense {
    const existing = this.expenses.find((entry) => entry.id === expenseId);
    if (!existing) {
      throw new Error('Expense not found');
    }

    if (existing.createdByProfileId !== this.me.id) {
      throw new Error('You can only edit expenses you added');
    }

    const updated: Expense = {
      ...existing,
      gameTitle: payload.gameTitle,
      trueAchievementsUrl: payload.trueAchievementsUrl || trueAchievementsGameUrl(payload.gameTitle),
      amount: payload.amount,
      paidByMemberId: payload.paidByMemberId,
      netToPayer: payload.netToPayer,
      expenseDate: payload.expenseDate,
      currency: payload.currency,
      category: payload.category
    };

    this.expenses = this.expenses.map((entry) => (entry.id === expenseId ? updated : entry));
    return updated;
  }

  removeExpense(expenseId: string): void {
    const expense = this.expenses.find((entry) => entry.id === expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    if (expense.createdByProfileId !== this.me.id) {
      throw new Error('You can only delete expenses you added');
    }

    this.expenses = this.expenses.filter((entry) => entry.id !== expenseId);
  }

  removeBill(billId: string): void {
    const bill = this.bills.find((entry) => entry.id === billId);
    if (!bill) {
      throw new Error('Bill not found');
    }

    if (bill.createdByProfileId !== this.me.id) {
      throw new Error('You can only delete bills you created');
    }

    this.bills = this.bills.filter((entry) => entry.id !== billId);
    this.expenses = this.expenses.filter((entry) => entry.billId !== billId);

    if (this.activeBillId === billId) {
      this.activeBillId = this.bills[0]?.id ?? null;
    }
  }

  reset(): void {
    this.bills = [...this.seedBills];
    this.expenses = [...this.seedExpenses];
    this.activeBillId = this.seedBills[0]?.id ?? null;
  }
}

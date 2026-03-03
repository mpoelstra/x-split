export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
}

export interface Group {
  id: string;
  name: string;
  members: GroupMember[];
}

export interface GroupMember {
  id: string;
  profileId: string;
  displayName: string;
  email?: string;
  role: 'owner' | 'member';
}

export interface Bill {
  id: string;
  groupId: string;
  title: string;
  friendMemberId?: string;
  friendName: string;
  inviteEmail?: string;
  createdAt: string;
}

export interface CreateBillInput {
  title: string;
  friendMemberId?: string;
  friendName?: string;
  inviteEmail?: string;
}

export interface Expense {
  id: string;
  groupId: string;
  billId: string;
  createdByProfileId?: string;
  gameTitle: string;
  trueAchievementsUrl?: string;
  amount: number;
  currency: string;
  paidByMemberId: string;
  netToPayer?: number;
  expenseDate: string;
  category?: string;
  source: 'manual' | 'csv_import';
  createdAt: string;
}

export interface CreateExpenseInput {
  gameTitle: string;
  trueAchievementsUrl?: string;
  amount: number;
  paidByMemberId: string;
  netToPayer?: number;
  expenseDate: string;
  currency: string;
  category?: string;
  source?: 'manual' | 'csv_import';
}

export interface UpdateExpenseInput extends CreateExpenseInput {}

export interface BalanceSummary {
  memberId: string;
  displayName: string;
  paidTotal: number;
  shareTotal: number;
  balance: number;
}

export interface DashboardStats {
  totalExpenses: number;
  currentUserBalance: number;
}

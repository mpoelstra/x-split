import { inject, Injectable } from '@angular/core';
import { Observable, from, map, of, switchMap, tap } from 'rxjs';
import {
  Bill,
  CreateBillInput,
  CreateExpenseInput,
  Expense,
  Group,
  GroupMember,
  UpdateExpenseInput
} from '../models/domain.models';
import { IDataGateway } from './data-gateway';
import { SupabaseClientService } from '../supabase/supabase-client.service';
import { trueAchievementsGameUrl } from '../utils/trueachievements-link';

interface MemberLookupRow {
  id: string;
  role: 'owner' | 'member';
  profiles: {
    id: string;
    display_name: string;
    email: string;
  };
}

interface CurrentMemberRow extends MemberLookupRow {
  joined_at: string;
  groups: {
    id: string;
    name: string;
  };
}

interface ExpenseRow {
  id: string;
  group_id: string;
  bill_id: string;
  created_by_profile_id: string | null;
  game_title: string;
  trueachievements_url: string | null;
  amount: number | string;
  currency: string;
  paid_by_member_id: string;
  net_to_payer: number | string | null;
  expense_date: string;
  category: string | null;
  source: 'manual' | 'csv_import' | null;
  created_at: string;
}

const isConflictError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string }).code;
  return code === '23505';
};

@Injectable()
export class SupabaseDataGateway implements IDataGateway {
  private readonly client = inject(SupabaseClientService).client;
  private currentBillId: string | null = null;
  private currentGroupId: string | null = null;

  private mapExpenseRow(row: ExpenseRow): Expense {
    return {
      id: row.id,
      groupId: row.group_id,
      billId: row.bill_id,
      createdByProfileId: row.created_by_profile_id ?? undefined,
      gameTitle: row.game_title,
      trueAchievementsUrl: row.trueachievements_url ?? undefined,
      amount: Number(row.amount),
      currency: row.currency,
      paidByMemberId: row.paid_by_member_id,
      netToPayer: row.net_to_payer != null ? Number(row.net_to_payer) : undefined,
      expenseDate: row.expense_date,
      category: row.category ?? undefined,
      source: row.source ?? 'manual',
      createdAt: row.created_at
    };
  }

  private ensureDisplayNameFromEmail(email: string | undefined): string {
    if (!email) {
      return 'Unknown user';
    }

    return email.split('@')[0].replace(/[._-]/g, ' ').trim() || email;
  }

  private async acceptPendingInvites(userEmail: string | undefined): Promise<void> {
    const normalized = userEmail?.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    const { error } = await this.client.rpc('accept_pending_invites_for_current_user');
    if (error) {
      throw error;
    }
  }

  private async ensureProfileExists(
    user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  ): Promise<void> {
    const displayName =
      (user.user_metadata?.['full_name'] as string | undefined) ??
      this.ensureDisplayNameFromEmail(user.email) ??
      'Unknown user';

    const { error: profileError } = await this.client.from('profiles').insert({
      id: user.id,
      display_name: displayName,
      email: user.email ?? `${user.id}@example.com`
    });
    if (profileError && !isConflictError(profileError)) {
      throw profileError;
    }
  }

  private async getLatestMembershipForUser(userId: string): Promise<CurrentMemberRow | null> {
    const { data, error } = await this.client
      .from('group_members')
      .select('id,role,joined_at,profiles!inner(id,display_name),groups!inner(id,name)')
      .eq('profile_id', userId)
      .order('joined_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as unknown as CurrentMemberRow | null) ?? null;
  }

  private async ensureBootstrapMembership(
    user: { id: string; email?: string; user_metadata?: Record<string, unknown> }
  ): Promise<CurrentMemberRow | null> {
    await this.ensureProfileExists(user);
    await this.acceptPendingInvites(user.email);

    const latestMembership = await this.getLatestMembershipForUser(user.id);
    if (latestMembership) {
      return latestMembership;
    }

    const groupId = `group-${user.id.slice(0, 8)}`;
    const groupName = 'X-Split';

    const { error: groupError } = await this.client.from('groups').insert({
      id: groupId,
      name: groupName,
      created_by: user.id
    });
    if (groupError && !isConflictError(groupError)) {
      throw groupError;
    }

    const memberId = `member-${user.id.slice(0, 8)}`;
    const { error: memberError } = await this.client.from('group_members').insert({
      id: memberId,
      group_id: groupId,
      profile_id: user.id,
      role: 'owner'
    });
    if (memberError && !isConflictError(memberError)) {
      throw memberError;
    }

    return await this.getLatestMembershipForUser(user.id);
  }

  getCurrentGroup(): Observable<Group> {
    return from(this.client.auth.getSession()).pipe(
      switchMap(({ data }) => {
        const user = data.session?.user;
        if (!user) {
          throw new Error('No authenticated user');
        }

        return from(this.ensureBootstrapMembership(user));
      }),
      switchMap((membership) => {
        if (!membership) {
          throw new Error('No group membership found for current user');
        }
        const current = membership as CurrentMemberRow;
        const groupId = current.groups.id;
        const groupName = current.groups.name;
        return from(
          this.client
            .from('group_members')
            .select('id,role,profiles!inner(id,display_name,email)')
            .eq('group_id', groupId)
        ).pipe(
          map(({ data: memberRows, error: memberError }) => {
            if (memberError) {
              throw memberError;
            }

            const members: GroupMember[] = ((memberRows ?? []) as unknown as MemberLookupRow[]).map((row) => ({
              id: row.id,
              profileId: row.profiles.id,
              displayName: row.profiles.display_name,
              email: row.profiles.email,
              role: row.role
            }));

            return {
              id: groupId,
              name: groupName,
              members
            } satisfies Group;
          })
        );
      }),
      tap((group) => {
        this.currentGroupId = group.id;
      })
    );
  }

  getBills(): Observable<Bill[]> {
    const fetchByGroupId = (groupId: string): Observable<Bill[]> =>
      from(
        this.client
          .from('bills')
          .select('id,group_id,title,friend_member_id,friend_name,invite_email,created_at')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false })
      ).pipe(
        map(({ data, error }) => {
          if (error) {
            throw error;
          }

          return (data ?? []).map((row) => ({
            id: row.id as string,
            groupId: row.group_id as string,
            title: row.title as string,
            friendMemberId: row.friend_member_id as string | undefined,
            friendName: (row.friend_name as string) || 'Friend',
            inviteEmail: row.invite_email as string | undefined,
            createdAt: row.created_at as string
          } satisfies Bill));
        }),
        tap((bills) => {
          if (!this.currentBillId && bills.length > 0) {
            this.currentBillId = bills[0].id;
          }
        })
      );

    if (this.currentGroupId) {
      return fetchByGroupId(this.currentGroupId);
    }

    return this.getCurrentGroup().pipe(
      switchMap((group) => fetchByGroupId(group.id))
    );
  }

  createBill(input: CreateBillInput): Observable<Bill> {
    return this.getCurrentGroup().pipe(
      switchMap((group) => {
        const resolveFriendMember = async (): Promise<string | undefined> => {
          if (input.friendMemberId) {
            return input.friendMemberId;
          }

          const inviteEmail = input.inviteEmail?.trim();
          if (!inviteEmail) {
            return undefined;
          }

          const { data, error } = await this.client
            .from('group_members')
            .select('id,profiles!inner(email)')
            .eq('group_id', group.id)
            .ilike('profiles.email', inviteEmail)
            .limit(1)
            .maybeSingle();

          if (error) {
            return undefined;
          }

          return (data?.id as string | undefined) ?? undefined;
        };

        return from(resolveFriendMember()).pipe(
          switchMap((friendMemberId) =>
            from(
              this.client
                .from('bills')
                .insert({
                  group_id: group.id,
                  title: input.title,
                  friend_member_id: friendMemberId,
                  friend_name: input.friendName,
                  invite_email: input.inviteEmail?.trim()
                })
                .select('id,group_id,title,friend_member_id,friend_name,invite_email,created_at')
                .single()
            )
          ),
          switchMap(({ data, error }) => {
            if (error || !data) {
              throw error ?? new Error('Unable to create bill');
            }

            const inviteEmail = (data.invite_email as string | undefined)?.trim().toLowerCase();
            if (!inviteEmail || data.friend_member_id) {
              return of({ data, error: null });
            }

            return from(
              this.client.from('invites').insert({
                group_id: data.group_id,
                bill_id: data.id,
                invite_email: inviteEmail
              })
            ).pipe(
              map(({ error: inviteError }) => {
                if (inviteError && !isConflictError(inviteError)) {
                  throw inviteError;
                }

                return { data, error: null };
              })
            );
          })
        );
      }),
      map(({ data, error }) => {
        if (error || !data) {
          throw error ?? new Error('Unable to create bill');
        }

        const bill: Bill = {
          id: data.id as string,
          groupId: data.group_id as string,
          title: data.title as string,
          friendMemberId: data.friend_member_id as string | undefined,
          friendName: (data.friend_name as string) || 'Friend',
          inviteEmail: data.invite_email as string | undefined,
          createdAt: data.created_at as string
        };

        this.currentBillId = bill.id;
        return bill;
      })
    );
  }

  getCurrentBill(): Observable<Bill | null> {
    if (!this.currentBillId) {
      return this.getBills().pipe(map((bills) => bills[0] ?? null));
    }

    return this.getBills().pipe(
      map((bills) => bills.find((bill) => bill.id === this.currentBillId) ?? bills[0] ?? null)
    );
  }

  setCurrentBill(billId: string): Observable<Bill> {
    this.currentBillId = billId;
    return this.getBills().pipe(
      map((bills) => {
        const bill = bills.find((entry) => entry.id === billId);
        if (!bill) {
          throw new Error('Bill not found');
        }

        return bill;
      })
    );
  }

  ensurePendingInviteMember(billId: string): Observable<string> {
    return from(
      this.client.rpc('ensure_pending_member_for_bill', { target_bill_id: billId })
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          throw error;
        }

        if (!data || typeof data !== 'string') {
          throw new Error('Unable to resolve pending invite member');
        }

        return data;
      })
    );
  }

  getExpenses(): Observable<Expense[]> {
    const fetchByBillId = (billId: string): Observable<Expense[]> =>
      from(
          this.client
            .from('expenses')
            .select(
            'id,group_id,bill_id,created_by_profile_id,game_title,trueachievements_url,amount,currency,paid_by_member_id,net_to_payer,expense_date,category,source,created_at'
          )
          .eq('bill_id', billId)
          .order('expense_date', { ascending: false })
      ).pipe(
        map(({ data, error }) => {
          if (error) {
            throw error;
          }

          return (data ?? []).map((row) => this.mapExpenseRow(row as ExpenseRow));
        })
      );

    if (this.currentBillId) {
      return fetchByBillId(this.currentBillId);
    }

    return this.getCurrentBill().pipe(
      switchMap((currentBill) => {
        if (!currentBill) {
          return of([]);
        }

        return fetchByBillId(currentBill.id);
      })
    );
  }

  getExpenseById(expenseId: string): Observable<Expense> {
    return from(
      this.client
        .from('expenses')
        .select(
          'id,group_id,bill_id,created_by_profile_id,game_title,trueachievements_url,amount,currency,paid_by_member_id,net_to_payer,expense_date,category,source,created_at'
        )
        .eq('id', expenseId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          throw error ?? new Error('Expense not found');
        }

        return this.mapExpenseRow(data as ExpenseRow);
      })
    );
  }

  createExpense(input: CreateExpenseInput): Observable<Expense> {
    return this.getCurrentGroup().pipe(
      switchMap((group) =>
        this.getCurrentBill().pipe(
          switchMap((bill) => {
            if (!bill) {
              throw new Error('No selected bill');
            }

            return from(
              this.client
                .from('expenses')
                .insert({
                  group_id: group.id,
                  bill_id: bill.id,
                  game_title: input.gameTitle,
                  trueachievements_url: input.trueAchievementsUrl || trueAchievementsGameUrl(input.gameTitle),
                  amount: input.amount,
                  currency: input.currency,
                  paid_by_member_id: input.paidByMemberId,
                  net_to_payer: input.netToPayer,
                  expense_date: input.expenseDate,
                  category: input.category,
                  source: input.source ?? 'manual'
                })
                .select(
                  'id,group_id,bill_id,created_by_profile_id,game_title,trueachievements_url,amount,currency,paid_by_member_id,net_to_payer,expense_date,category,source,created_at'
                )
                .single()
            );
          })
        )
      ),
      map(({ data, error }) => {
        if (error || !data) {
          throw error ?? new Error('Unable to create expense');
        }

        return this.mapExpenseRow(data as ExpenseRow);
      })
    );
  }

  updateExpense(expenseId: string, input: UpdateExpenseInput): Observable<Expense> {
    return from(
      this.client
        .from('expenses')
        .update({
          game_title: input.gameTitle,
          trueachievements_url: input.trueAchievementsUrl || trueAchievementsGameUrl(input.gameTitle),
          amount: input.amount,
          currency: input.currency,
          paid_by_member_id: input.paidByMemberId,
          net_to_payer: input.netToPayer,
          expense_date: input.expenseDate,
          category: input.category
        })
        .eq('id', expenseId)
        .select(
          'id,group_id,bill_id,created_by_profile_id,game_title,trueachievements_url,amount,currency,paid_by_member_id,net_to_payer,expense_date,category,source,created_at'
        )
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) {
          throw error ?? new Error('Unable to update expense');
        }

        return this.mapExpenseRow(data as ExpenseRow);
      })
    );
  }

  deleteExpense(expenseId: string): Observable<void> {
    return from(
      this.client.from('expenses').delete().eq('id', expenseId)
    ).pipe(
      map(({ error }) => {
        if (error) {
          throw error;
        }
      })
    );
  }

  adminResetData(): Observable<void> {
    return from(this.client.rpc('admin_reset_app_data')).pipe(
      map(({ error }) => {
        if (error) {
          throw error;
        }

        this.currentBillId = null;
        this.currentGroupId = null;
      })
    );
  }
}

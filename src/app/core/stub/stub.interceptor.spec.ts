import { HTTP_INTERCEPTORS, HttpClient, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { BalanceSummary, Bill, Expense, Group, UserProfile } from '../models/domain.models';
import { StubInterceptor } from './stub.interceptor';

describe('StubInterceptor', () => {
  let http: HttpClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        { provide: HTTP_INTERCEPTORS, useClass: StubInterceptor, multi: true }
      ]
    });

    http = TestBed.inject(HttpClient);
  });

  it('returns deterministic me endpoint', async () => {
    const me = await firstValueFrom(http.get<UserProfile>('/api/me'));
    expect(me.displayName).toContain('Mark');
  });

  it('returns seeded group and balances', async () => {
    const group = await firstValueFrom(http.get<Group>('/api/groups/current'));
    const balances = await firstValueFrom(http.get<BalanceSummary[]>('/api/balances'));

    expect(group.members.length).toBe(2);
    expect(balances.length).toBe(2);
  });

  it('creates expense and returns updated list', async () => {
    const created = await firstValueFrom(
      http.post<Expense>('/api/expenses', {
        gameTitle: 'Test Game',
        amount: 20,
        paidByMemberId: 'member-mark',
        expenseDate: '2026-03-01',
        currency: 'EUR'
      })
    );

    const list = await firstValueFrom(http.get<Expense[]>('/api/expenses'));
    expect(list[0].gameTitle).toBe('Test Game');
    expect(list[0].billId).toBeTruthy();

    await firstValueFrom(http.delete<void>(`/api/expenses/${created.id}`));
    const afterDelete = await firstValueFrom(http.get<Expense[]>('/api/expenses'));
    expect(afterDelete.some((expense) => expense.id === created.id)).toBeFalse();
  });

  it('supports creating and selecting bills', async () => {
    const created = await firstValueFrom(
      http.post<Bill>('/api/bills', {
        title: 'New Bill',
        inviteEmail: 'friend@example.com',
        friendName: 'friend'
      })
    );

    expect(created.title).toBe('New Bill');

    const selected = await firstValueFrom(
      http.post<Bill>('/api/bills/current', {
        billId: created.id
      })
    );

    expect(selected.id).toBe(created.id);
  });
});

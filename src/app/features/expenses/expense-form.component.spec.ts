import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { ExpenseFormComponent } from './expense-form.component';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';

describe('ExpenseFormComponent', () => {
  let component: ExpenseFormComponent;
  let addExpenseSpy: jasmine.Spy<(payload: unknown) => unknown>;
  let navigateByUrlSpy: jasmine.Spy<(url: string) => Promise<boolean>>;
  const billMembers = [
    { id: 'm1', profileId: 'u1', displayName: 'Mark', role: 'owner' as const },
    { id: 'm2', profileId: 'u2', displayName: 'Richard', role: 'member' as const }
  ];

  beforeEach(async () => {
    addExpenseSpy = jasmine.createSpy('addExpense').and.returnValue(
      of({
        id: 'e1',
        groupId: 'g1',
        billId: 'b1',
        gameTitle: 'Halo Infinite',
        amount: 59.99,
        currency: 'EUR',
        paidByMemberId: 'm1',
        expenseDate: '2026-03-01',
        source: 'manual',
        createdAt: '2026-03-01T12:00:00Z'
      })
    );
    navigateByUrlSpy = jasmine.createSpy('navigateByUrl').and.returnValue(Promise.resolve(true));

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: ExpenseService,
          useValue: {
            getCurrentGroup: () =>
              of({
                id: 'g1',
                name: 'X-Split',
                members: [
                  ...billMembers,
                  { id: 'm3', profileId: 'u3', displayName: 'Lucas', role: 'member' }
                ]
              }),
            addExpense: addExpenseSpy,
            getCurrentBill: () =>
              of({
                id: 'b1',
                groupId: 'g1',
                title: 'Xbox Games',
                createdByProfileId: 'u1',
                friendMemberId: 'm2',
                friendName: 'Richard',
                createdAt: '2026-03-01T00:00:00Z'
              }),
            getBillMembers: () => billMembers
          }
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: navigateByUrlSpy
          }
        },
        {
          provide: AuthService,
          useValue: {
            user: () => ({ id: 'u1', displayName: 'Mark', email: 'mark@example.com' })
          }
        }
      ]
    });

    component = TestBed.runInInjectionContext(() => new ExpenseFormComponent());
  });

  it('requires game title and positive amount', () => {
    component.form.controls.gameTitle.setValue('');
    component.form.controls.amount.setValue('0');

    expect(component.form.invalid).toBeTrue();
  });

  it('submits expected normalized payload when valid', async () => {
    component.form.controls.gameTitle.setValue('Halo Infinite');
    component.form.controls.amount.setValue('59.99');
    component.form.controls.paidByMemberId.setValue('m1');
    component.form.controls.expenseDate.setValue('2026-03-01');
    component.form.controls.trueAchievementsUrl.setValue('   ');

    await component.submit();

    expect(addExpenseSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      gameTitle: 'Halo Infinite',
      amount: 59.99,
      netToPayer: 30,
      paidByMemberId: 'm1',
      expenseDate: '2026-03-01',
      currency: 'EUR',
      trueAchievementsUrl: undefined,
      category: 'Spelletjes'
    }));
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/app/dashboard');
  });

  it('accepts both dot/comma decimals and rejects >2 decimals', () => {
    component.form.controls.amount.setValue('9');
    expect(component.form.controls.amount.valid).toBeTrue();

    component.form.controls.amount.setValue('9.1');
    expect(component.form.controls.amount.valid).toBeTrue();

    component.form.controls.amount.setValue('9.99');
    expect(component.form.controls.amount.valid).toBeTrue();

    component.form.controls.amount.setValue('4,99');
    expect(component.form.controls.amount.valid).toBeTrue();

    component.form.controls.amount.setValue('5.123');
    expect(component.form.controls.amount.valid).toBeFalse();
  });

  it('normalizes comma decimals in submit payload', async () => {
    component.form.controls.gameTitle.setValue('Halo Infinite');
    component.form.controls.amount.setValue('4,99');
    component.form.controls.paidByMemberId.setValue('m1');
    component.form.controls.expenseDate.setValue('2026-03-01');

    await component.submit();

    expect(addExpenseSpy).toHaveBeenCalledWith(jasmine.objectContaining({
      amount: 4.99,
      netToPayer: 2.5
    }));
  });

  it('limits payer options to members on the active bill', () => {
    expect(component.memberOptions().map((member) => member.id)).toEqual(['m1', 'm2']);
    expect(component.memberOptions().some((member) => member.id === 'm3')).toBeFalse();
  });
});

import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { ExpenseEditComponent } from './expense-edit.component';

describe('ExpenseEditComponent', () => {
  const expense = {
    id: 'e1',
    groupId: 'g1',
    billId: 'b1',
    createdByProfileId: 'u1',
    gameTitle: 'Dead Island Retro Revenge',
    trueAchievementsUrl: 'https://www.trueachievements.com/game/Dead-Island-Retro-Revenge/achievements',
    amount: 9.99,
    currency: 'EUR',
    paidByMemberId: 'm1',
    netToPayer: 5,
    expenseDate: '2026-03-02',
    category: 'Spelletjes',
    source: 'csv_import' as const,
    createdAt: '2026-03-02T10:00:00Z'
  };

  let updateExpenseSpy: jasmine.Spy<(id: string, payload: unknown) => unknown>;
  let getExpenseByIdSpy: jasmine.Spy<(id: string) => unknown>;
  let navigateByUrlSpy: jasmine.Spy<(url: string) => Promise<boolean>>;
  let component: ExpenseEditComponent;

  beforeEach(async () => {
    updateExpenseSpy = jasmine.createSpy('updateExpense').and.returnValue(of(expense));
    getExpenseByIdSpy = jasmine.createSpy('getExpenseById').and.returnValue(of(expense));
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
                  { id: 'm1', profileId: 'u1', displayName: 'Mark', role: 'owner' },
                  { id: 'm2', profileId: 'u2', displayName: 'Andrea', role: 'member' }
                ]
              }),
            getCurrentBill: () =>
              of({
                id: 'b1',
                groupId: 'g1',
                title: 'Xbox Games',
                friendName: 'Andrea',
                createdAt: '2026-03-01T00:00:00Z'
              }),
            getExpenseById: getExpenseByIdSpy,
            updateExpense: updateExpenseSpy
          }
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: navigateByUrlSpy
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ expenseId: 'e1' })
            }
          }
        }
      ]
    });

    component = TestBed.runInInjectionContext(() => new ExpenseEditComponent());
  });

  it('loads a single expense by id and patches the form', async () => {
    await component.ngOnInit();

    expect(getExpenseByIdSpy).toHaveBeenCalledWith('e1');
    expect(component.form.controls.gameTitle.value).toBe(expense.gameTitle);
    expect(component.form.controls.amount.value).toBe('9.99');
    expect(component.form.controls.paidByMemberId.value).toBe('m1');
  });

  it('submits normalized update payload and redirects', async () => {
    await component.ngOnInit();
    component.form.controls.amount.setValue('10000');
    component.form.controls.trueAchievementsUrl.setValue('   ');
    component.form.controls.paidByMemberId.setValue('m2');

    await component.submit();

    expect(updateExpenseSpy).toHaveBeenCalledWith('e1', jasmine.objectContaining({
      gameTitle: expense.gameTitle,
      amount: 10000,
      netToPayer: 5000,
      paidByMemberId: 'm2',
      trueAchievementsUrl: undefined,
      source: 'csv_import'
    }));
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/app/expenses');
  });

  it('normalizes comma decimals in update payload', async () => {
    await component.ngOnInit();
    component.form.controls.amount.setValue('9,99');

    await component.submit();

    expect(updateExpenseSpy).toHaveBeenCalledWith('e1', jasmine.objectContaining({
      amount: 9.99,
      netToPayer: 5
    }));
  });
});

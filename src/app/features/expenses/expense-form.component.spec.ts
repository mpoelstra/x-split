import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { ExpenseFormComponent } from './expense-form.component';
import { ExpenseService } from '../../core/data/expense.service';

describe('ExpenseFormComponent', () => {
  let fixture: ComponentFixture<ExpenseFormComponent>;
  let component: ExpenseFormComponent;
  let addExpenseSpy: jasmine.Spy;

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

    await TestBed.configureTestingModule({
      imports: [ExpenseFormComponent],
      providers: [
        {
          provide: ExpenseService,
          useValue: {
            billSelectionChanged$: of('b1'),
            getCurrentGroup: () =>
              of({
                id: 'g1',
                name: 'X-Split',
                members: [{ id: 'm1', profileId: 'u1', displayName: 'Mark', role: 'owner' }]
              }),
            addExpense: addExpenseSpy,
            getCurrentBill: () =>
              of({
                id: 'b1',
                groupId: 'g1',
                title: 'Xbox Games',
                friendName: 'Richard',
                createdAt: '2026-03-01T00:00:00Z'
              })
          }
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: () => Promise.resolve(true)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ExpenseFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('requires game title and positive amount', () => {
    component.form.controls.gameTitle.setValue('');
    component.form.controls.amount.setValue('0');

    expect(component.form.invalid).toBeTrue();
  });

  it('submits payload when valid', async () => {
    component.form.controls.gameTitle.setValue('Halo Infinite');
    component.form.controls.amount.setValue('59.99');
    component.form.controls.paidByMemberId.setValue('m1');
    component.form.controls.expenseDate.setValue('2026-03-01');

    await component.submit();

    expect(addExpenseSpy).toHaveBeenCalled();
  });

  it('accepts 9, 9.1, 9.99 and rejects comma or >2 decimals', () => {
    component.form.controls.amount.setValue('9');
    expect(component.form.controls.amount.valid).toBeTrue();

    component.form.controls.amount.setValue('9.1');
    expect(component.form.controls.amount.valid).toBeTrue();

    component.form.controls.amount.setValue('9.99');
    expect(component.form.controls.amount.valid).toBeTrue();

    component.form.controls.amount.setValue('4,99');
    expect(component.form.controls.amount.valid).toBeFalse();

    component.form.controls.amount.setValue('5.123');
    expect(component.form.controls.amount.valid).toBeFalse();
  });
});

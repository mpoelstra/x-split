import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { Bill, Group } from '../../core/models/domain.models';

@Component({
    selector: 'app-expense-form',
    imports: [ReactiveFormsModule],
    templateUrl: './expense-form.component.html',
    styleUrl: './expense-form.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpenseFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly router = inject(Router);

  readonly group = signal<Group | null>(null);
  readonly currentBill = signal<Bill | null>(null);
  readonly submitting = signal(false);

  private readonly moneyPattern = /^\d+(\.\d{1,2})?$/;

  private readonly validMoney = (control: AbstractControl<string>): ValidationErrors | null => {
    const raw = control.value?.trim() ?? '';
    if (!raw) {
      return { required: true };
    }
    if (raw.includes(',')) {
      return { commaNotAllowed: true };
    }
    if (!this.moneyPattern.test(raw)) {
      const decimalPart = raw.split('.')[1];
      if (decimalPart && decimalPart.length > 2) {
        return { tooManyDecimals: true };
      }

      return { moneyFormat: true };
    }
    if (Number(raw) <= 0) {
      return { min: true };
    }

    return null;
  };

  readonly memberOptions = computed(() => this.group()?.members ?? []);

  readonly form = this.fb.nonNullable.group({
    gameTitle: ['', Validators.required],
    amount: ['0', [this.validMoney]],
    paidByMemberId: ['', Validators.required],
    expenseDate: [new Date().toISOString().slice(0, 10), Validators.required],
    currency: ['EUR', Validators.required],
    category: ['Spelletjes']
  });

  amountErrorMessage(): string {
    const control = this.form.controls.amount;
    if (!control.touched || !control.invalid) {
      return '';
    }

    if (control.errors?.['required']) {
      return 'Amount is required.';
    }
    if (control.errors?.['commaNotAllowed']) {
      return 'Use a dot for decimals (example: 9.99), not a comma.';
    }
    if (control.errors?.['tooManyDecimals']) {
      return 'Use at most 2 decimal digits.';
    }
    if (control.errors?.['min']) {
      return 'Amount must be greater than 0.';
    }

    return 'Enter a valid amount (examples: 9, 9.1, 9.99).';
  }

  constructor() {
    this.expenseService.getCurrentGroup()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (group) => {
        this.group.set(group);
        if (!this.form.controls.paidByMemberId.value && group.members.length > 0) {
          this.form.controls.paidByMemberId.setValue(group.members[0].id);
        }
      },
      error: () => this.group.set(null)
    });
    this.expenseService.getCurrentBill()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: async (bill) => {
        this.currentBill.set(bill);
        if (!bill) {
          await this.router.navigateByUrl('/app/bills');
        }
      },
      error: async () => {
        this.currentBill.set(null);
        await this.router.navigateByUrl('/app/bills');
      }
    });
  }

  async goBack(): Promise<void> {
    await this.router.navigateByUrl('/app/dashboard');
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    this.submitting.set(true);
    const payload = {
      ...this.form.getRawValue(),
      amount: Number(this.form.controls.amount.value)
    };

    try {
      await firstValueFrom(this.expenseService.addExpense(payload));
      await this.router.navigateByUrl('/app/dashboard');
    } finally {
      this.submitting.set(false);
    }
  }
}

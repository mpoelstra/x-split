import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { DEFAULT_EXPENSE_CATEGORY } from '../../core/constants/expense.constants';
import { Bill, Expense, Group } from '../../core/models/domain.models';
import { calculateNetToPayer } from '../../core/utils/net-to-payer';
import { trueAchievementsGameUrl } from '../../core/utils/trueachievements-link';

@Component({
  selector: 'app-expense-edit',
  imports: [ReactiveFormsModule],
  templateUrl: './expense-edit.component.html',
  styleUrl: './expense-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExpenseEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly user = this.authService.user;
  readonly group = signal<Group | null>(null);
  readonly currentBill = signal<Bill | null>(null);
  readonly expense = signal<Expense | null>(null);
  readonly submitting = signal(false);
  private readonly expenseId = this.route.snapshot.paramMap.get('expenseId') ?? '';
  private taUrlManuallyEdited = false;
  private formPatchedFromExpense = false;

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
    trueAchievementsUrl: [''],
    amount: ['0', [this.validMoney]],
    paidByMemberId: ['', Validators.required],
    expenseDate: [new Date().toISOString().slice(0, 10), Validators.required],
    currency: ['EUR', Validators.required],
    category: [DEFAULT_EXPENSE_CATEGORY]
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
        next: (group) => this.group.set(group),
        error: () => this.group.set(null)
      });
    this.expenseService.getCurrentBill()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: async (bill) => {
          this.currentBill.set(bill);
          if (!bill) {
            await this.router.navigateByUrl('/app/expenses');
          }
        },
        error: async () => {
          this.currentBill.set(null);
          await this.router.navigateByUrl('/app/expenses');
        }
      });
  }

  async ngOnInit(): Promise<void> {
    if (!this.expenseId) {
      await this.router.navigateByUrl('/app/expenses');
      return;
    }

    try {
      const expense = await firstValueFrom(this.expenseService.getExpenseById(this.expenseId));
      this.expense.set(expense);
      this.patchForm(expense);
    } catch {
      this.expense.set(null);
      await this.router.navigateByUrl('/app/expenses');
    }
  }

  async goBack(): Promise<void> {
    await this.router.navigateByUrl('/app/expenses');
  }

  async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.expense()) {
      return;
    }

    this.submitting.set(true);
    const amount = Number(this.form.controls.amount.value);
    const payload = {
      ...this.form.getRawValue(),
      amount,
      trueAchievementsUrl: this.form.controls.trueAchievementsUrl.value.trim() || undefined,
      netToPayer: calculateNetToPayer(amount),
      source: this.expense()?.source
    };

    try {
      await firstValueFrom(this.expenseService.updateExpense(this.expenseId, payload));
      await this.router.navigateByUrl('/app/expenses');
    } finally {
      this.submitting.set(false);
    }
  }

  onGameTitleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const gameTitle = input.value;
    if (!this.taUrlManuallyEdited) {
      this.form.controls.trueAchievementsUrl.setValue(
        gameTitle.trim() ? trueAchievementsGameUrl(gameTitle) : ''
      );
    }
  }

  onTrueAchievementsUrlInput(event: Event): void {
    this.taUrlManuallyEdited = true;
    const input = event.target as HTMLInputElement;
    this.form.controls.trueAchievementsUrl.setValue(input.value);
  }

  resetTrueAchievementsUrlAuto(): void {
    this.taUrlManuallyEdited = false;
    const gameTitle = this.form.controls.gameTitle.value;
    this.form.controls.trueAchievementsUrl.setValue(
      gameTitle.trim() ? trueAchievementsGameUrl(gameTitle) : ''
    );
  }

  openTrueAchievementsUrl(): void {
    const url = this.form.controls.trueAchievementsUrl.value.trim();
    if (!url) {
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  billCounterpartyName(bill: Bill): string {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return bill.friendName;
    }

    const meMember = group.members.find((member) => member.profileId === me.id);
    if (!meMember) {
      return bill.friendName;
    }

    if (bill.friendMemberId) {
      if (bill.friendMemberId === meMember.id) {
        const owner = group.members.find((member) => member.role === 'owner' && member.id !== meMember.id);
        const fallback = group.members.find((member) => member.id !== meMember.id);
        return owner?.displayName ?? fallback?.displayName ?? bill.friendName;
      }

      return group.members.find((member) => member.id === bill.friendMemberId)?.displayName ?? bill.friendName;
    }

    return bill.friendName;
  }

  private patchForm(expense: Expense): void {
    if (this.formPatchedFromExpense) {
      return;
    }

    this.form.controls.gameTitle.setValue(expense.gameTitle);
    this.form.controls.trueAchievementsUrl.setValue(
      expense.trueAchievementsUrl || trueAchievementsGameUrl(expense.gameTitle)
    );
    this.form.controls.amount.setValue(expense.amount.toFixed(2));
    this.form.controls.paidByMemberId.setValue(expense.paidByMemberId);
    this.form.controls.expenseDate.setValue(expense.expenseDate);
    this.form.controls.currency.setValue(expense.currency);
    this.form.controls.category.setValue(expense.category || DEFAULT_EXPENSE_CATEGORY);
    this.taUrlManuallyEdited = Boolean(expense.trueAchievementsUrl);
    this.formPatchedFromExpense = true;
  }
}

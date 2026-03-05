import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { DEFAULT_EXPENSE_CATEGORY } from '../../core/constants/expense.constants';
import { Bill, Group } from '../../core/models/domain.models';
import { calculateNetToPayer } from '../../core/utils/net-to-payer';
import { trueAchievementsGameUrl } from '../../core/utils/trueachievements-link';

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
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.authService.user;
  readonly group = signal<Group | null>(null);
  readonly currentBill = signal<Bill | null>(null);
  readonly submitting = signal(false);
  private taUrlManuallyEdited = false;

  private readonly moneyPattern = /^\d+([.,]\d{1,2})?$/;

  private readonly validMoney = (control: AbstractControl<string>): ValidationErrors | null => {
    const raw = control.value?.trim() ?? '';
    if (!raw) {
      return { required: true };
    }
    if (!this.moneyPattern.test(raw)) {
      const decimalPart = raw.split(/[.,]/)[1];
      if (decimalPart && decimalPart.length > 2) {
        return { tooManyDecimals: true };
      }

      return { moneyFormat: true };
    }
    if (this.parseAmount(raw) <= 0) {
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
    if (control.errors?.['tooManyDecimals']) {
      return 'Use at most 2 decimal digits.';
    }
    if (control.errors?.['min']) {
      return 'Amount must be greater than 0.';
    }

    return 'Enter a valid amount (examples: 9, 9.1, 9.99, 9,99).';
  }

  constructor() {
    this.expenseService.getCurrentGroup()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (group) => {
        this.group.set(group);
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

    effect(() => {
      const group = this.group();
      if (!group || group.members.length === 0) {
        return;
      }

      const me = this.user();
      const selectedMemberId = this.form.controls.paidByMemberId.value;
      const meMemberId = me ? group.members.find((member) => member.profileId === me.id)?.id : undefined;

      if (meMemberId) {
        if (!selectedMemberId || (this.form.controls.paidByMemberId.pristine && selectedMemberId !== meMemberId)) {
          this.form.controls.paidByMemberId.setValue(meMemberId);
        }
        return;
      }

      if (!selectedMemberId) {
        this.form.controls.paidByMemberId.setValue(group.members[0].id);
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

    const amount = this.parseAmount(this.form.controls.amount.value);
    this.submitting.set(true);
    const payload = {
      ...this.form.getRawValue(),
      trueAchievementsUrl: this.form.controls.trueAchievementsUrl.value.trim() || undefined,
      amount,
      netToPayer: calculateNetToPayer(amount)
    };

    try {
      await firstValueFrom(this.expenseService.addExpense(payload));
      await this.router.navigateByUrl('/app/dashboard');
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

  private parseAmount(raw: string): number {
    return Number(raw.trim().replace(',', '.'));
  }
}

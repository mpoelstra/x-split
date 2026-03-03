import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { BalanceSummary, Bill, CreateBillInput, Group } from '../../core/models/domain.models';

type BillStatusTone = 'owed' | 'owe' | 'even';

interface BillStatus {
  tone: BillStatusTone;
  amount: number;
}

@Component({
  selector: 'app-bills',
  imports: [ReactiveFormsModule, CurrencyPipe],
  templateUrl: './bills.component.html',
  styleUrl: './bills.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillsComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly user = this.authService.user;
  readonly group = signal<Group | null>(null);
  readonly bills = signal<Bill[]>([]);
  readonly currentBill = signal<Bill | null>(null);
  readonly balances = signal<BalanceSummary[]>([]);
  readonly billStatuses = signal<Record<string, BillStatus>>({});
  readonly creating = signal(false);

  readonly friendOptions = computed(() => {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return [];
    }

    return group.members.filter((member) => member.profileId !== me.id);
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(64)]],
    shareMode: ['friend'],
    friendMemberId: [''],
    inviteEmail: ['']
  });

  constructor() {
    this.expenseService.getCurrentGroup().pipe(takeUntilDestroyed()).subscribe({
      next: (group) => {
        this.group.set(group);
        if (this.friendOptions().length > 0) {
          if (!this.form.controls.friendMemberId.value) {
            this.form.controls.friendMemberId.setValue(this.friendOptions()[0].id);
          }
        } else {
          this.form.controls.shareMode.setValue('invite');
        }
        this.refreshCurrentBillStatus();
      },
      error: () => this.group.set(null)
    });

    this.expenseService.getBills().pipe(takeUntilDestroyed()).subscribe({
      next: (bills) => this.bills.set(bills),
      error: () => this.bills.set([])
    });

    this.expenseService.getCurrentBill().pipe(takeUntilDestroyed()).subscribe({
      next: (bill) => {
        this.currentBill.set(bill);
        this.refreshCurrentBillStatus();
      },
      error: () => {
        this.currentBill.set(null);
        this.billStatuses.set({});
      }
    });

    this.expenseService.getBalances().pipe(takeUntilDestroyed()).subscribe({
      next: (balances) => {
        this.balances.set(balances);
        this.refreshCurrentBillStatus();
      },
      error: () => {
        this.balances.set([]);
        this.billStatuses.set({});
      }
    });
  }

  async selectBill(bill: Bill): Promise<void> {
    const selected = await firstValueFrom(this.expenseService.setCurrentBill(bill.id));
    this.currentBill.set(selected);
  }

  async openBill(bill: Bill): Promise<void> {
    const selected = await firstValueFrom(this.expenseService.setCurrentBill(bill.id));
    this.currentBill.set(selected);
    await this.router.navigateByUrl('/app/dashboard');
  }

  statusFor(billId: string): BillStatus | null {
    return this.billStatuses()[billId] ?? null;
  }

  private refreshCurrentBillStatus(): void {
    const current = this.currentBill();
    const group = this.group();
    const me = this.user();
    if (!current || !group || !me) {
      this.billStatuses.set({});
      return;
    }

    const meMember = group.members.find((member) => member.profileId === me.id);
    if (!meMember) {
      this.billStatuses.set({});
      return;
    }

    const balance = this.balances().find((entry) => entry.memberId === meMember.id)?.balance ?? 0;
    const amount = Math.round(Math.abs(balance) * 100) / 100;
    let tone: BillStatusTone = 'even';
    if (balance > 0.01) {
      tone = 'owed';
    } else if (balance < -0.01) {
      tone = 'owe';
    }

    this.billStatuses.set({
      [current.id]: { tone, amount }
    });
  }

  private validateShareSelection(): boolean {
    const mode = this.form.controls.shareMode.value;
    if (mode === 'friend') {
      const friendId = this.form.controls.friendMemberId.value.trim();
      if (!friendId) {
        this.form.controls.friendMemberId.setErrors({ required: true });
        return false;
      }

      this.form.controls.inviteEmail.setErrors(null);
      return true;
    }

    const email = this.form.controls.inviteEmail.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.form.controls.inviteEmail.setErrors({ email: true });
      return false;
    }

    this.form.controls.friendMemberId.setErrors(null);
    return true;
  }

  async submit(): Promise<void> {
    this.form.controls.title.markAsTouched();
    if (this.form.controls.title.invalid || !this.validateShareSelection()) {
      return;
    }

    const mode = this.form.controls.shareMode.value;
    const input: CreateBillInput = {
      title: this.form.controls.title.value.trim()
    };

    if (mode === 'friend') {
      input.friendMemberId = this.form.controls.friendMemberId.value;
    } else {
      input.inviteEmail = this.form.controls.inviteEmail.value.trim();
      input.friendName = input.inviteEmail.split('@')[0];
    }

    this.creating.set(true);
    try {
      const bill = await firstValueFrom(this.expenseService.createBill(input));
      this.currentBill.set(bill);
      this.form.reset({
        title: '',
        shareMode: 'friend',
        friendMemberId: this.friendOptions()[0]?.id ?? '',
        inviteEmail: ''
      });
      await this.router.navigateByUrl('/app/dashboard');
    } finally {
      this.creating.set(false);
    }
  }
}

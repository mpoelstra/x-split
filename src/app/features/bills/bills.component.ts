import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CurrencyPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { BalanceSummary, Bill, CreateBillInput, Group } from '../../core/models/domain.models';

type BillStatusTone = 'owed' | 'owe' | 'even';

interface BillStatus {
  tone: BillStatusTone;
  amount: number;
}

interface BillCounterparty {
  name: string;
  email?: string;
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
  readonly groupLoadError = signal(false);
  readonly billsLoadError = signal(false);
  readonly currentBillLoadError = signal(false);
  readonly balancesLoadError = signal(false);
  readonly hasLoadError = computed(
    () => this.groupLoadError() || this.billsLoadError() || this.currentBillLoadError() || this.balancesLoadError()
  );
  readonly group = toSignal(
    this.expenseService.getCurrentGroup().pipe(
      catchError(() => {
        this.groupLoadError.set(true);
        return of<Group | null>(null);
      })
    ),
    { initialValue: null }
  );
  readonly bills = toSignal(
    this.expenseService.getBills().pipe(
      catchError(() => {
        this.billsLoadError.set(true);
        return of<Bill[]>([]);
      })
    ),
    { initialValue: [] }
  );
  readonly currentBill = toSignal(
    this.expenseService.getCurrentBill().pipe(
      catchError(() => {
        this.currentBillLoadError.set(true);
        return of<Bill | null>(null);
      })
    ),
    { initialValue: null }
  );
  readonly balances = toSignal(
    this.expenseService.getBalances().pipe(
      catchError(() => {
        this.balancesLoadError.set(true);
        return of<BalanceSummary[]>([]);
      })
    ),
    { initialValue: [] }
  );
  readonly billStatuses = computed<Record<string, BillStatus>>(() => {
    const current = this.currentBill();
    const group = this.group();
    const me = this.user();
    if (!current || !group || !me) {
      return {};
    }

    const meMember = group.members.find((member) => member.profileId === me.id);
    if (!meMember) {
      return {};
    }

    const balance = this.balances().find((entry) => entry.memberId === meMember.id)?.balance ?? 0;
    const amount = Math.round(Math.abs(balance) * 100) / 100;
    let tone: BillStatusTone = 'even';
    if (balance > 0.01) {
      tone = 'owed';
    } else if (balance < -0.01) {
      tone = 'owe';
    }

    return {
      [current.id]: { tone, amount }
    };
  });
  readonly creating = signal(false);
  readonly deletingBillId = signal<string | null>(null);

  readonly friendOptions = computed(() => {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return [];
    }

    return group.members.filter((member) => member.profileId !== me.id && !this.isPendingMember(member.email));
  });

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(64)]],
    shareMode: ['friend'],
    friendMemberId: [''],
    inviteEmail: ['']
  });

  constructor() {
    effect(() => {
      const options = this.friendOptions();
      if (options.length > 0) {
        if (!this.form.controls.friendMemberId.value) {
          this.form.controls.friendMemberId.setValue(options[0].id);
        }
      } else {
        this.form.controls.shareMode.setValue('invite');
      }
    });
  }

  async selectBill(bill: Bill): Promise<void> {
    await firstValueFrom(this.expenseService.setCurrentBill(bill.id));
  }

  async openBill(bill: Bill): Promise<void> {
    await firstValueFrom(this.expenseService.setCurrentBill(bill.id));
    await this.router.navigateByUrl('/app/dashboard');
  }

  canDeleteBill(bill: Bill): boolean {
    const me = this.user();
    if (!me) {
      return false;
    }

    return bill.createdByProfileId === me.id;
  }

  async deleteBill(bill: Bill, event?: Event): Promise<void> {
    event?.stopPropagation();
    event?.preventDefault();
    if (!this.canDeleteBill(bill) || this.deletingBillId()) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${bill.title}" and all linked expenses for this bill? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    this.deletingBillId.set(bill.id);
    try {
      await firstValueFrom(this.expenseService.deleteBill(bill.id));
    } finally {
      this.deletingBillId.set(null);
    }
  }

  statusFor(billId: string): BillStatus | null {
    return this.billStatuses()[billId] ?? null;
  }

  sharedWith(bill: Bill): BillCounterparty {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return { name: bill.friendName, email: bill.inviteEmail };
    }

    const meMember = group.members.find((member) => member.profileId === me.id);
    if (!meMember) {
      return { name: bill.friendName, email: bill.inviteEmail };
    }

    if (bill.friendMemberId) {
      if (bill.friendMemberId === meMember.id) {
        const owner = group.members.find((member) => member.role === 'owner' && member.id !== meMember.id);
        const fallback = group.members.find((member) => member.id !== meMember.id);
        const counterparty = owner ?? fallback;
        if (counterparty) {
          return { name: counterparty.displayName, email: counterparty.email };
        }
      } else {
        const friend = group.members.find((member) => member.id === bill.friendMemberId);
        if (friend) {
          if (this.isPendingMember(friend.email) && bill.inviteEmail) {
            return { name: bill.friendName, email: bill.inviteEmail };
          }
          return { name: friend.displayName, email: friend.email };
        }
      }
    }

    return { name: bill.friendName, email: bill.inviteEmail };
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
      await firstValueFrom(this.expenseService.createBill(input));
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

  private isPendingMember(email: string | undefined): boolean {
    if (!email) {
      return false;
    }

    return email.startsWith('pending+') && email.endsWith('@xsplit.local');
  }
}

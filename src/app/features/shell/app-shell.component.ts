import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { BalanceSummary, Bill, Group } from '../../core/models/domain.models';

type BillTone = 'owed' | 'owe' | 'even';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);

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
  readonly switchingBill = signal(false);
  readonly avatarLoadFailed = signal(false);
  readonly userDisplayName = computed(() => this.user()?.displayName || 'Account');
  readonly userInitials = computed(() => {
    const source = this.user()?.displayName?.trim() || this.user()?.email || 'A';
    const parts = source.split(/\s+/).filter((part) => part.length > 0);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  });
  readonly currentMemberId = computed(() => {
    const group = this.group();
    const me = this.user();
    if (!group || !me) {
      return null;
    }

    return group.members.find((entry) => entry.profileId === me.id)?.id ?? null;
  });
  readonly currentBalance = computed(() => {
    const memberId = this.currentMemberId();
    if (!memberId) {
      return 0;
    }

    return this.balances().find((entry) => entry.memberId === memberId)?.balance ?? 0;
  });
  readonly billTone = computed<BillTone>(() => {
    const value = this.currentBalance();
    if (value > 0.01) {
      return 'owed';
    }
    if (value < -0.01) {
      return 'owe';
    }
    return 'even';
  });
  readonly billAmount = computed(() => Math.round(Math.abs(this.currentBalance()) * 100) / 100);

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

  billOptionLabel(bill: Bill): string {
    return `${bill.title} - ${this.billCounterpartyName(bill)}`;
  }

  async onBillSelect(event: Event): Promise<void> {
    const select = event.target as HTMLSelectElement;
    const billId = select.value;
    if (!billId || billId === this.currentBill()?.id) {
      return;
    }

    this.switchingBill.set(true);
    try {
      await firstValueFrom(this.expenseService.setCurrentBill(billId));
    } finally {
      this.switchingBill.set(false);
    }
  }

  onAvatarLoadError(): void {
    this.avatarLoadFailed.set(true);
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ExpenseService } from '../../core/data/expense.service';
import { AuthService } from '../../core/auth/auth.service';
import { Bill, Group } from '../../core/models/domain.models';

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
  readonly group = signal<Group | null>(null);
  readonly bills = signal<Bill[]>([]);
  readonly currentBill = signal<Bill | null>(null);
  readonly currentBalance = signal(0);
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

  constructor() {
    this.reloadBills();
    this.expenseService.billSelectionChanged$
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.reloadBills());
  }

  reloadBills(): void {
    this.expenseService.getCurrentGroup().subscribe({
      next: (group) => this.group.set(group),
      error: () => this.group.set(null)
    });
    this.expenseService.getBills().subscribe({
      next: (bills) => this.bills.set(bills),
      error: () => this.bills.set([])
    });
    this.expenseService.getCurrentBill().subscribe({
      next: (bill) => this.currentBill.set(bill),
      error: () => this.currentBill.set(null)
    });
    this.expenseService.getBalances().subscribe({
      next: (balances) => {
        const group = this.group();
        const me = this.user();
        if (!group || !me) {
          this.currentBalance.set(0);
          return;
        }

        const member = group.members.find((entry) => entry.profileId === me.id);
        if (!member) {
          this.currentBalance.set(0);
          return;
        }

        this.currentBalance.set(balances.find((entry) => entry.memberId === member.id)?.balance ?? 0);
      },
      error: () => this.currentBalance.set(0)
    });
  }

  onBillSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const billId = select.value;
    if (!billId || billId === this.currentBill()?.id) {
      return;
    }

    this.switchingBill.set(true);
    this.expenseService.setCurrentBill(billId).subscribe({
      next: (bill) => {
        this.currentBill.set(bill);
        this.reloadBills();
        this.switchingBill.set(false);
      },
      error: () => {
        this.switchingBill.set(false);
      }
    });
  }

  onAvatarLoadError(): void {
    this.avatarLoadFailed.set(true);
  }
}

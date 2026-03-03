import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExpenseService } from '../../core/data/expense.service';
import { Bill } from '../../core/models/domain.models';

interface FriendSummary {
  key: string;
  friendName: string;
  contact: string;
  billCount: number;
  latestBillTitle: string;
  latestBillDate: string;
  includesCurrentBill: boolean;
  recentBills: string[];
}

@Component({
  selector: 'app-friends',
  imports: [RouterLink, DatePipe],
  templateUrl: './friends.component.html',
  styleUrl: './friends.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FriendsComponent {
  private readonly expenseService = inject(ExpenseService);

  readonly bills = signal<Bill[]>([]);
  readonly currentBill = signal<Bill | null>(null);

  readonly friends = computed<FriendSummary[]>(() => {
    const grouped = new Map<string, FriendSummary>();
    const currentBillId = this.currentBill()?.id;

    for (const bill of this.bills()) {
      const key = `${bill.friendName}::${bill.inviteEmail ?? ''}`;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          key,
          friendName: bill.friendName,
          contact: bill.inviteEmail || 'Connected friend',
          billCount: 1,
          latestBillTitle: bill.title,
          latestBillDate: bill.createdAt,
          includesCurrentBill: bill.id === currentBillId,
          recentBills: [bill.title]
        });
        continue;
      }

      existing.billCount += 1;
      existing.includesCurrentBill = existing.includesCurrentBill || bill.id === currentBillId;

      if (bill.createdAt > existing.latestBillDate) {
        existing.latestBillDate = bill.createdAt;
        existing.latestBillTitle = bill.title;
      }

      if (existing.recentBills.length < 3 && !existing.recentBills.includes(bill.title)) {
        existing.recentBills.push(bill.title);
      }
    }

    return [...grouped.values()].sort((a, b) => b.latestBillDate.localeCompare(a.latestBillDate));
  });

  constructor() {
    this.expenseService.getBills()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (bills) => this.bills.set(bills),
      error: () => this.bills.set([])
    });
    this.expenseService.getCurrentBill()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (bill) => this.currentBill.set(bill),
      error: () => this.currentBill.set(null)
    });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BillStatsService } from './bill-stats.service';
import { RankedListCardComponent, RankedListItem } from '../../shared/ranked-list-card/ranked-list-card.component';
import { SectionCardComponent } from '../../shared/section-card/section-card.component';
import { StatMetricCardComponent } from '../../shared/stat-metric-card/stat-metric-card.component';
import { trueAchievementsGameUrl } from '../../core/utils/trueachievements-link';
import { compareExpensesNewestFirst } from '../../core/utils/expense-sort';
import { Expense } from '../../core/models/domain.models';

@Component({
  selector: 'app-bill-stats',
  imports: [
    CurrencyPipe,
    BaseChartDirective,
    RankedListCardComponent,
    SectionCardComponent,
    StatMetricCardComponent
  ],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './bill-stats.component.html',
  styleUrl: './bill-stats.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BillStatsComponent {
  private readonly billStatsService = inject(BillStatsService);

  readonly currentBill = this.billStatsService.currentBill;
  readonly stats = this.billStatsService.stats;
  readonly expenses = this.billStatsService.expenses;
  readonly chartType = 'line' as const;

  readonly summaryMetrics = computed(() => {
    const stats = this.stats();
    const currency = stats.currency;
    return [
      {
        label: 'Total spend',
        value: formatCurrency(stats.totalSpend, currency),
        detail: `${stats.summaryCardCount} purchases in this bill`
      },
      {
        label: 'Unique titles',
        value: `${stats.uniqueTitles}`,
        detail: `${stats.duplicateGroups.length} exact duplicate groups`
      },
      {
        label: 'Average price',
        value: formatCurrency(stats.averagePrice, currency),
        detail: `Median ${formatCurrency(stats.medianPrice, currency)}`
      },
      {
        label: 'Longest streak',
        value: `${stats.longestWeeklyStreak} week${stats.longestWeeklyStreak === 1 ? '' : 's'}`,
        detail: 'Consecutive weeks with at least one purchase'
      },
      {
        label: 'Bargain hunter',
        value: `${stats.bargainHunterScore.toFixed(0)}%`,
        detail: 'Purchases at or below EUR 10'
      },
      {
        label: 'Premium taste',
        value: `${stats.premiumTasteScore.toFixed(0)}%`,
        detail: 'Purchases above EUR 50'
      }
    ];
  });

  readonly mostExpensiveItems = computed<RankedListItem[]>(() =>
    this.stats().mostExpensive.map((item) => ({
      label: item.title,
      href: this.gameUrl(item.title, item.trueAchievementsUrl),
      value: formatCurrency(item.amount, this.stats().currency),
      detail: `${item.payerName} • ${item.expenseDate}`
    }))
  );

  readonly cheapestItems = computed<RankedListItem[]>(() =>
    this.stats().cheapest.map((item) => ({
      label: item.title,
      href: this.gameUrl(item.title, item.trueAchievementsUrl),
      value: formatCurrency(item.amount, this.stats().currency),
      detail: `${item.payerName} • ${item.expenseDate}`
    }))
  );

  readonly spreeItems = computed<RankedListItem[]>(() =>
    this.stats().biggestSpreeDays.map((day) => ({
      label: day.date,
      value: formatCurrency(day.totalSpend, this.stats().currency),
      detailPrefix: `${day.purchaseCount} purchases • `,
      detailParts: day.titles.map((title, index) => ({
        label: `${index > 0 ? ', ' : ''}${title}`,
        href: this.gameUrl(title)
      })),
      detailCollapseLimit: 4
    }))
  );

  readonly spendByPersonItems = computed<RankedListItem[]>(() =>
    this.stats().spendByPerson.map((entry) => ({
      label: entry.name,
      value: formatCurrency(entry.totalSpend, this.stats().currency),
      detail: `${entry.purchaseCount} purchases • avg ${formatCurrency(entry.averagePrice, this.stats().currency)}`
    }))
  );

  readonly mostItemsDayItems = computed<RankedListItem[]>(() =>
    this.stats().mostItemsDays.map((day) => ({
      label: day.date,
      value: `${day.purchaseCount} game${day.purchaseCount === 1 ? '' : 's'}`,
      detailParts: day.titles.map((title, index) => ({
        label: `${index > 0 ? ', ' : ''}${title}`,
        href: this.gameUrl(title)
      })),
      detailCollapseLimit: 4
    }))
  );

  readonly titleLengthItems = computed<RankedListItem[]>(() => {
    const stats = this.stats().titleLengthStats;
    const items: RankedListItem[] = [];

    if (stats.longest) {
      items.push({
        label: 'Longest',
        href: this.gameUrl(stats.longest.title, stats.longest.trueAchievementsUrl),
        value: `${stats.longest.title.length} chars`,
        detail: stats.longest.title
      });
    }

    if (stats.shortest) {
      items.push({
        label: 'Shortest',
        href: this.gameUrl(stats.shortest.title, stats.shortest.trueAchievementsUrl),
        value: `${stats.shortest.title.length} chars`,
        detail: stats.shortest.title
      });
    }

    return items;
  });

  readonly jointMilestoneItems = computed<RankedListItem[]>(() =>
    this.stats().jointMilestones.map((milestone) => ({
      label: milestone.label,
      value: milestone.purchase.expenseDate,
      detailParts: [
        { label: `${milestone.purchase.payerName} • ` },
        {
          label: milestone.purchase.title,
          href: this.gameUrl(milestone.purchase.title, milestone.purchase.trueAchievementsUrl)
        }
      ]
    }))
  );

  readonly memberMilestoneCards = computed(() =>
    this.stats().memberMilestones.map((entry) => ({
      title: `${entry.name} Milestones`,
      subtitle: `Purchase checkpoints for ${entry.name.toLowerCase()}.`,
      items: entry.milestones.map((milestone) => ({
        label: milestone.label,
        value: milestone.purchase.expenseDate,
        detailParts: [
          {
            label: milestone.purchase.title,
            href: this.gameUrl(milestone.purchase.title, milestone.purchase.trueAchievementsUrl)
          }
        ]
      }))
    }))
  );

  readonly orderedExpenses = computed(() => [...this.expenses()].sort(compareExpensesNewestFirst));

  readonly randomGamePick = computed(() => {
    const expenses = this.orderedExpenses();
    const billId = this.currentBill()?.id ?? 'bill';
    if (expenses.length === 0) {
      return null;
    }

    const index = stableIndex(`${billId}:${dailySeed()}:random-game`, expenses.length);
    const expense = expenses[index] ?? expenses[0];
    if (!expense) {
      return null;
    }

    return {
      expense,
      position: index + 1,
      total: expenses.length
    };
  });

  readonly weirdTitlePick = computed(() => {
    const expenses = this.expenses();
    const billId = this.currentBill()?.id ?? 'bill';
    if (expenses.length === 0) {
      return null;
    }

    const ranked = [...expenses]
      .map((expense) => ({ expense, score: weirdTitleScore(expense.gameTitle) }))
      .sort((a, b) => b.score - a.score || b.expense.gameTitle.length - a.expense.gameTitle.length || a.expense.id.localeCompare(b.expense.id));
    const candidates = ranked.filter((entry) => entry.score > 0).slice(0, 8);
    const pool = candidates.length > 0 ? candidates : ranked.slice(0, Math.min(8, ranked.length));
    const index = stableIndex(`${billId}:${dailySeed()}:weird-title`, pool.length);
    const selected = pool[index];
    if (!selected) {
      return null;
    }

    return {
      expense: selected.expense,
      reason: weirdTitleReason(selected.expense.gameTitle)
    };
  });

  readonly chartData = computed<ChartData<'line'>>(() => ({
    labels: this.stats().spendTimeline.map((point) => point.label),
    datasets: [
      {
        data: this.stats().spendTimeline.map((point) => Math.round(point.totalSpend * 100) / 100),
        label: 'Spend',
        tension: 0.28,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 4,
        borderColor: '#c8d748',
        backgroundColor: 'rgba(200, 215, 72, 0.16)'
      }
    ]
  }));

  readonly chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(18, 22, 12, 0.94)',
        borderColor: 'rgba(137, 147, 17, 0.4)',
        borderWidth: 1,
        titleColor: '#f2f5e9',
        bodyColor: '#d8e0ce',
        padding: 10
      }
    },
    scales: {
      x: {
        ticks: {
          color: '#8f9c89'
        },
        grid: {
          color: 'rgba(122, 122, 16, 0.1)'
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: '#8f9c89'
        },
        grid: {
          color: 'rgba(122, 122, 16, 0.1)'
        }
      }
    }
  };

  gameUrl(gameTitle: string, explicitUrl?: string): string {
    return explicitUrl || trueAchievementsGameUrl(gameTitle);
  }
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(value);
}

function stableIndex(seed: string, length: number): number {
  if (length <= 0) {
    return 0;
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }

  return Math.abs(hash) % length;
}

function dailySeed(): string {
  return new Date().toISOString().slice(0, 10);
}

function weirdTitleScore(title: string): number {
  const punctuationMatches = title.match(/[:\-!&'.,/]/g) ?? [];
  const digitMatches = title.match(/\d/g) ?? [];
  const wordCount = title.trim().split(/\s+/).filter(Boolean).length;
  const uppercaseTokens = title.split(/\s+/).filter((token) => token.length >= 2 && token === token.toUpperCase()).length;

  return punctuationMatches.length * 3 + digitMatches.length * 2 + Math.max(wordCount - 3, 0) + uppercaseTokens * 2;
}

function weirdTitleReason(title: string): string {
  const wordCount = title.trim().split(/\s+/).filter(Boolean).length;
  if (/\d/.test(title) && /[:\-]/.test(title)) {
    return 'Numbers and punctuation chaos.';
  }
  if (wordCount >= 6) {
    return 'This title refuses to be brief.';
  }
  if (/[:\-]/.test(title)) {
    return 'Subtitle energy detected.';
  }
  if (/[!&]/.test(title)) {
    return 'Extra punctuation for dramatic effect.';
  }
  return 'A gloriously odd-looking name.';
}

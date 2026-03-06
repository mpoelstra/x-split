import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BillStatsService } from './bill-stats.service';
import { RankedListCardComponent, RankedListItem } from '../../shared/ranked-list-card/ranked-list-card.component';
import { SectionCardComponent } from '../../shared/section-card/section-card.component';
import { StatMetricCardComponent } from '../../shared/stat-metric-card/stat-metric-card.component';
import { trueAchievementsGameUrl } from '../../core/utils/trueachievements-link';

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
      detailParts: [
        { label: `${day.purchaseCount} purchases • ` },
        ...day.titles.map((title, index) => ({
          label: `${index > 0 ? ', ' : ''}${title}`,
          href: this.gameUrl(title)
        }))
      ]
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
      }))
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

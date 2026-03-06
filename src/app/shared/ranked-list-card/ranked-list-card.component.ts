import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { SectionCardComponent } from '../section-card/section-card.component';

export interface RankedListItem {
  label: string;
  href?: string;
  value: string;
  detail?: string;
  detailPrefix?: string;
  detailParts?: Array<{ label: string; href?: string }>;
  detailCollapseLimit?: number;
}

@Component({
  selector: 'app-ranked-list-card',
  imports: [SectionCardComponent],
  templateUrl: './ranked-list-card.component.html',
  styleUrl: './ranked-list-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RankedListCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly items = input.required<RankedListItem[]>();
  readonly emptyLabel = input<string>('No data yet.');
  private readonly expandedKeys = signal(new Set<string>());

  itemKey(item: RankedListItem): string {
    return `${item.label}::${item.value}`;
  }

  visibleDetailParts(item: RankedListItem): Array<{ label: string; href?: string }> {
    const parts = item.detailParts ?? [];
    const limit = item.detailCollapseLimit ?? parts.length;
    if (this.expandedKeys().has(this.itemKey(item)) || parts.length <= limit) {
      return parts;
    }

    return parts.slice(0, limit);
  }

  hasHiddenDetailParts(item: RankedListItem): boolean {
    const parts = item.detailParts ?? [];
    const limit = item.detailCollapseLimit ?? parts.length;
    return parts.length > limit;
  }

  hiddenDetailCount(item: RankedListItem): number {
    const parts = item.detailParts ?? [];
    const limit = item.detailCollapseLimit ?? parts.length;
    return Math.max(parts.length - limit, 0);
  }

  isExpanded(item: RankedListItem): boolean {
    return this.expandedKeys().has(this.itemKey(item));
  }

  toggleExpanded(item: RankedListItem): void {
    const next = new Set(this.expandedKeys());
    const key = this.itemKey(item);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.expandedKeys.set(next);
  }
}

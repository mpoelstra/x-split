import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SectionCardComponent } from '../section-card/section-card.component';

export interface RankedListItem {
  label: string;
  href?: string;
  value: string;
  detail?: string;
  detailParts?: Array<{ label: string; href?: string }>;
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
}

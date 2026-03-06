import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-metric-card',
  templateUrl: './stat-metric-card.component.html',
  styleUrl: './stat-metric-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatMetricCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly detail = input<string>('');
}

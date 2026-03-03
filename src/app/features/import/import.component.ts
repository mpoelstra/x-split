import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ExpenseService } from '../../core/data/expense.service';
import { Bill, CreateExpenseInput, Group } from '../../core/models/domain.models';
import { trueAchievementsGameUrl } from '../../core/utils/trueachievements-link';

interface ParsedCsvRow {
  line: number;
  expenseDate: string;
  gameTitle: string;
  category?: string;
  amount: number;
  currency: string;
  participantValues: Record<string, number>;
}

interface ImportPlan {
  ready: CreateExpenseInput[];
  skipped: { line: number; reason: string }[];
}

interface ImportResult {
  inserted: number;
  skipped: number;
  failed: number;
}

interface ImportMemberOption {
  id: string;
  displayName: string;
  isPendingInvite?: boolean;
}

@Component({
  selector: 'app-import',
  imports: [RouterLink],
  templateUrl: './import.component.html',
  styleUrl: './import.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImportComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly authService = inject(AuthService);

  readonly user = this.authService.user;
  readonly group = signal<Group | null>(null);
  readonly bills = signal<Bill[]>([]);
  readonly selectedBillId = signal<string>('');
  readonly newBillTitle = signal('Imported Splitwise');
  readonly friendInviteEmail = signal('');
  readonly creatingBill = signal(false);

  readonly fileName = signal('');
  readonly parseError = signal('');
  readonly parsedRows = signal<ParsedCsvRow[]>([]);
  readonly participantHeaders = signal<string[]>([]);
  readonly headerMapping = signal<Record<string, string>>({});

  readonly importing = signal(false);
  readonly importProcessed = signal(0);
  readonly importTotal = signal(0);
  readonly result = signal<ImportResult | null>(null);

  readonly canImport = computed(() => {
    if (!this.selectedBillId()) {
      return false;
    }

    if (this.parsedRows().length === 0) {
      return false;
    }

    const headers = this.participantHeaders();
    const mapping = this.headerMapping();
    if (headers.length === 0) {
      return false;
    }

    for (const header of headers) {
      if (!mapping[header]) {
        return false;
      }
    }

    return true;
  });

  readonly selectedBillTitle = computed(
    () => this.bills().find((bill) => bill.id === this.selectedBillId())?.title ?? '-'
  );
  readonly selectedBill = computed(() => this.bills().find((bill) => bill.id === this.selectedBillId()) ?? null);
  readonly pendingInviteOption = computed<ImportMemberOption | null>(() => {
    const bill = this.selectedBill();
    if (!bill?.inviteEmail || bill.friendMemberId) {
      return null;
    }

    return {
      id: `pending-invite:${bill.id}`,
      displayName: `${bill.inviteEmail} (pending invite)`,
      isPendingInvite: true
    };
  });
  readonly memberOptions = computed<ImportMemberOption[]>(() => {
    const members = (this.group()?.members ?? []).map((member) => ({
      id: member.id,
      displayName: member.displayName
    }));
    const pending = this.pendingInviteOption();
    if (pending) {
      members.push(pending);
    }

    return members;
  });

  readonly preview = computed(() => this.buildImportPlan());

  constructor() {
    this.expenseService.getCurrentGroup()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (group) => this.group.set(group),
      error: () => this.group.set(null)
    });
    this.expenseService.getBills()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (bills) => {
        this.bills.set(bills);
        if (!this.selectedBillId() && bills.length > 0) {
          this.selectedBillId.set(bills[0].id);
        }
      },
      error: () => this.bills.set([])
    });
    this.expenseService.getCurrentBill()
      .pipe(takeUntilDestroyed())
      .subscribe({
      next: (bill) => {
        if (bill) {
          this.selectedBillId.set(bill.id);
        }
      },
      error: () => {
        if (this.bills().length > 0) {
          this.selectedBillId.set(this.bills()[0].id);
        }
      }
    });
  }

  async onCsvFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    this.result.set(null);
    this.parseError.set('');
    this.parsedRows.set([]);
    this.participantHeaders.set([]);
    this.headerMapping.set({});

    if (!file) {
      this.fileName.set('');
      return;
    }

    this.fileName.set(file.name);

    try {
      const raw = await file.text();
      const parsed = this.parseSplitwiseCsv(raw);
      this.parsedRows.set(parsed.rows);
      this.participantHeaders.set(parsed.participantHeaders);
      this.headerMapping.set(this.defaultMapping(parsed.participantHeaders));
      this.parseError.set('');
    } catch (error) {
      this.parseError.set(error instanceof Error ? error.message : 'Could not parse CSV');
    }
  }

  onBillChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedBillId.set(select.value);
    this.result.set(null);
  }

  onNewBillTitleChange(event: Event): void {
    this.newBillTitle.set((event.target as HTMLInputElement).value);
  }

  onFriendInviteEmailChange(event: Event): void {
    this.friendInviteEmail.set((event.target as HTMLInputElement).value);
  }

  async createImportBill(): Promise<void> {
    const title = this.newBillTitle().trim();
    const inviteEmail = this.friendInviteEmail().trim();
    if (!title || !inviteEmail) {
      return;
    }

    this.creatingBill.set(true);
    try {
      const friendName = inviteEmail.split('@')[0] || 'Friend';
      const bill = await firstValueFrom(
        this.expenseService.createBill({
          title,
          inviteEmail,
          friendName
        })
      );
      this.selectedBillId.set(bill.id);
    } finally {
      this.creatingBill.set(false);
    }
  }

  onMappingChange(csvHeader: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const memberId = select.value;
    const next = { ...this.headerMapping() };
    next[csvHeader] = memberId;
    this.headerMapping.set(next);
    this.result.set(null);
  }

  async runImport(): Promise<void> {
    if (!this.canImport()) {
      return;
    }

    const resolvedMapping = await this.resolvePendingInviteMapping(this.headerMapping());
    const plan = this.buildImportPlan(resolvedMapping);
    if (plan.ready.length === 0) {
      this.result.set({ inserted: 0, skipped: plan.skipped.length, failed: 0 });
      return;
    }

    this.importing.set(true);
    this.importProcessed.set(0);
    this.importTotal.set(plan.ready.length);
    this.result.set(null);

    let inserted = 0;
    let failed = 0;

    try {
      await firstValueFrom(this.expenseService.setCurrentBill(this.selectedBillId()));

      for (const row of plan.ready) {
        try {
          await firstValueFrom(this.expenseService.addExpense(row));
          inserted += 1;
        } catch {
          failed += 1;
        }
        this.importProcessed.update((value) => value + 1);
      }

      this.result.set({
        inserted,
        skipped: plan.skipped.length,
        failed
      });

      this.headerMapping.set(resolvedMapping);
    } finally {
      this.importing.set(false);
    }
  }

  memberName(memberId: string): string {
    return this.memberOptions().find((member) => member.id === memberId)?.displayName ?? 'Unknown';
  }

  private defaultMapping(headers: string[]): Record<string, string> {
    const options = this.memberOptions();
    const me = this.user();
    const meMember = (this.group()?.members ?? []).find((member) => member.profileId === me?.id);
    const friendMember = options.find((member) => member.id !== meMember?.id);

    const mapped: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (index === 0 && meMember) {
        mapped[header] = meMember.id;
      } else if (index === 1 && friendMember) {
        mapped[header] = friendMember.id;
      } else {
        mapped[header] = options[index % Math.max(options.length, 1)]?.id ?? '';
      }
    });

    return mapped;
  }

  private async resolvePendingInviteMapping(mapping: Record<string, string>): Promise<Record<string, string>> {
    const pending = this.pendingInviteOption();
    if (!pending) {
      return { ...mapping };
    }

    const pendingSelected = Object.values(mapping).includes(pending.id);
    if (!pendingSelected) {
      return { ...mapping };
    }

    const memberId = await firstValueFrom(this.expenseService.ensurePendingInviteMember(this.selectedBillId()));
    const resolved: Record<string, string> = {};
    for (const [header, value] of Object.entries(mapping)) {
      resolved[header] = value === pending.id ? memberId : value;
    }

    return resolved;
  }

  private buildImportPlan(mapping: Record<string, string> = this.headerMapping()): ImportPlan {
    const headers = this.participantHeaders();

    const ready: CreateExpenseInput[] = [];
    const skipped: { line: number; reason: string }[] = [];

    for (const row of this.parsedRows()) {
      const payerHeaders = headers.filter((header) => (row.participantValues[header] ?? 0) > 0);

      if (payerHeaders.length !== 1) {
        skipped.push({ line: row.line, reason: 'ambiguous payer (expected exactly one positive value)' });
        continue;
      }

      const payerMemberId = mapping[payerHeaders[0]];
      if (!payerMemberId) {
        skipped.push({ line: row.line, reason: `unmapped payer column: ${payerHeaders[0]}` });
        continue;
      }

      ready.push({
        gameTitle: row.gameTitle,
        trueAchievementsUrl: trueAchievementsGameUrl(row.gameTitle),
        amount: row.amount,
        paidByMemberId: payerMemberId,
        netToPayer: Math.abs(row.participantValues[payerHeaders[0]] ?? 0),
        expenseDate: row.expenseDate,
        currency: row.currency,
        category: row.category,
        source: 'csv_import'
      });
    }

    return { ready, skipped };
  }

  private parseSplitwiseCsv(raw: string): { participantHeaders: string[]; rows: ParsedCsvRow[] } {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new Error('CSV has no data rows.');
    }

    const header = this.parseCsvLine(lines[0]);
    if (header.length < 7) {
      throw new Error('CSV header is too short. Expected date, description, category, cost, currency and participant columns.');
    }

    const participantHeaders = header.slice(5);
    const rows: ParsedCsvRow[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      const row = this.parseCsvLine(line);
      if (row.length < 5) {
        continue;
      }

      const [expenseDate, gameTitle, category, cost, currency, ...participants] = row;

      if (gameTitle === 'Totaal saldo') {
        continue;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
        continue;
      }

      const amount = this.parseMoney(cost);
      if (!Number.isFinite(amount) || amount <= 0) {
        continue;
      }

      const participantValues: Record<string, number> = {};
      for (let p = 0; p < participantHeaders.length; p += 1) {
        participantValues[participantHeaders[p]] = this.parseMoney(participants[p] ?? '0');
      }

      rows.push({
        line: i + 1,
        expenseDate,
        gameTitle,
        category: category || undefined,
        amount,
        currency: currency || 'EUR',
        participantValues
      });
    }

    return { participantHeaders, rows };
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  }

  private parseMoney(raw: string): number {
    const normalized = raw.replace(/[^0-9,.-]/g, '').replace(',', '.');
    if (!normalized || normalized === '-' || normalized === '.') {
      return 0;
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      return 0;
    }

    return Math.round(parsed * 100) / 100;
  }
}

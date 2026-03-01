import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const csvPath = process.env.CSV_PATH || resolve(process.cwd(), '../src/xbox-games_2026-03-01_export.csv');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const groupId = process.env.GROUP_ID || 'group-xsplit';
const groupName = process.env.GROUP_NAME || 'X-Split';

const markProfileId = process.env.MARK_PROFILE_ID;
const markDisplayName = process.env.MARK_DISPLAY_NAME || 'Mark Poelstra';
const markEmail = process.env.MARK_EMAIL || 'mark@example.com';

const richardProfileId = process.env.RICHARD_PROFILE_ID;
const richardDisplayName = process.env.RICHARD_DISPLAY_NAME || 'Richard Booij';
const richardEmail = process.env.RICHARD_EMAIL || 'richard@example.com';

const memberMarkId = process.env.MARK_MEMBER_ID || 'member-mark';
const memberRichardId = process.env.RICHARD_MEMBER_ID || 'member-richard';

const billTitle = process.env.BILL_TITLE || 'Xbox Games';
const runLive = process.env.MIGRATE_LIVE === 'true';

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
};

const toNumber = (value) => Number((value || '').replace(',', '.'));
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const normalizeAmount = (value) => Math.round(Number(value) * 100) / 100;

const run = async () => {
  const csvRaw = await readFile(csvPath, 'utf8');
  const lines = csvRaw.split(/\r?\n/).filter((line) => line.length > 0);

  const header = parseCsvLine(lines[0]);
  if (header.length < 7) {
    throw new Error('Unexpected CSV header. Expected at least 7 columns.');
  }

  const imported = [];
  const skipped = [];
  const ambiguous = [];

  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    if (row.length < 7) {
      skipped.push({ index: i + 1, reason: 'short_row' });
      continue;
    }

    const [date, description, category, cost, currency, mark, richard] = row;

    if (!isValidDate(date)) {
      skipped.push({ index: i + 1, reason: 'invalid_date' });
      continue;
    }

    if (description === 'Totaal saldo') {
      skipped.push({ index: i + 1, reason: 'balance_summary_row' });
      continue;
    }

    const amount = normalizeAmount(toNumber(cost));
    if (!Number.isFinite(amount) || amount <= 0) {
      skipped.push({ index: i + 1, reason: 'invalid_amount', raw: cost });
      continue;
    }

    const markValue = toNumber(mark);
    const richardValue = toNumber(richard);

    let payerAlias = '';
    if (markValue > 0 && richardValue < 0) {
      payerAlias = 'mark';
    } else if (richardValue > 0 && markValue < 0) {
      payerAlias = 'richard';
    } else {
      ambiguous.push({ index: i + 1, description, markValue, richardValue });
      continue;
    }

    imported.push({
      expense_date: date,
      game_title: description,
      category,
      amount,
      currency: currency || 'EUR',
      payer_alias: payerAlias,
      net_to_payer: Math.abs(payerAlias === 'mark' ? markValue : richardValue),
      source: 'csv_import'
    });
  }

  const report = {
    csvPath,
    totalRows: lines.length - 1,
    importedRows: imported.length,
    skippedRows: skipped.length,
    ambiguousRows: ambiguous.length,
    skipped,
    ambiguous
  };

  if (!runLive) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          report,
          liveRequirements: [
            'SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY',
            'MARK_PROFILE_ID',
            'RICHARD_PROFILE_ID'
          ]
        },
        null,
        2
      )
    );
    return;
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in live mode');
  }

  if (!markProfileId || !richardProfileId) {
    throw new Error('MARK_PROFILE_ID and RICHARD_PROFILE_ID are required in live mode');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { error: upsertProfilesError } = await supabase.from('profiles').upsert(
    [
      {
        id: markProfileId,
        display_name: markDisplayName,
        email: markEmail
      },
      {
        id: richardProfileId,
        display_name: richardDisplayName,
        email: richardEmail
      }
    ],
    { onConflict: 'id' }
  );

  if (upsertProfilesError) {
    throw upsertProfilesError;
  }

  const { error: upsertGroupError } = await supabase.from('groups').upsert(
    {
      id: groupId,
      name: groupName,
      created_by: markProfileId
    },
    { onConflict: 'id' }
  );

  if (upsertGroupError) {
    throw upsertGroupError;
  }

  const { error: upsertMembersError } = await supabase.from('group_members').upsert(
    [
      {
        id: memberMarkId,
        group_id: groupId,
        profile_id: markProfileId,
        role: 'owner'
      },
      {
        id: memberRichardId,
        group_id: groupId,
        profile_id: richardProfileId,
        role: 'member'
      }
    ],
    { onConflict: 'id' }
  );

  if (upsertMembersError) {
    throw upsertMembersError;
  }

  const { data: existingBill, error: selectBillError } = await supabase
    .from('bills')
    .select('id')
    .eq('group_id', groupId)
    .eq('title', billTitle)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectBillError) {
    throw selectBillError;
  }

  let billId = existingBill?.id;
  if (!billId) {
    const { data: insertedBill, error: insertBillError } = await supabase
      .from('bills')
      .insert({
        group_id: groupId,
        title: billTitle,
        friend_member_id: memberRichardId,
        friend_name: richardDisplayName,
        invite_email: richardEmail
      })
      .select('id')
      .single();

    if (insertBillError || !insertedBill) {
      throw insertBillError ?? new Error('Unable to create default bill for import');
    }

    billId = insertedBill.id;
  }

  const memberIdByAlias = new Map([
    ['mark', memberMarkId],
    ['richard', memberRichardId]
  ]);

  const { data: existingExpenses, error: existingExpensesError } = await supabase
    .from('expenses')
    .select('expense_date,game_title,amount,paid_by_member_id,source,bill_id')
    .eq('group_id', groupId)
    .eq('bill_id', billId)
    .eq('source', 'csv_import');

  if (existingExpensesError) {
    throw existingExpensesError;
  }

  const existingSignatures = new Set(
    (existingExpenses ?? []).map((row) =>
      [
        row.expense_date,
        row.game_title,
        normalizeAmount(row.amount),
        row.paid_by_member_id,
        row.bill_id
      ].join('|')
    )
  );

  const payload = imported
    .map((row) => ({
      group_id: groupId,
      bill_id: billId,
      game_title: row.game_title,
      category: row.category || null,
      amount: row.amount,
      currency: row.currency,
      paid_by_member_id: memberIdByAlias.get(row.payer_alias),
      net_to_payer: row.net_to_payer,
      expense_date: row.expense_date,
      source: row.source
    }))
    .filter((row) => row.paid_by_member_id)
    .filter(
      (row) =>
        !existingSignatures.has(
          [row.expense_date, row.game_title, normalizeAmount(row.amount), row.paid_by_member_id, row.bill_id].join('|')
        )
    );

  if (payload.length > 0) {
    const { error: insertError } = await supabase.from('expenses').insert(payload);
    if (insertError) {
      throw insertError;
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: 'live',
        report,
        bootstrap: {
          groupId,
          groupName,
          memberMarkId,
          memberRichardId,
          billId,
          billTitle
        },
        insertedRows: payload.length,
        skippedAsDuplicate: imported.length - payload.length
      },
      null,
      2
    )
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

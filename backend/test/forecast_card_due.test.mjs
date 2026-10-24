import assert from 'node:assert/strict';
import {
  parseRolloverTaipeiDate,
  resolveBilledCardSchedule,
  resolveUnbilledCardSchedule,
} from '../src/handlers/forecast.ts';

function makeToday(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day, dateStr };
}

console.log('Running forecast_card_due.test.mjs...');

// 1. Same-month due date overdue (statement_day = 5, payment_due_day = 20, today = 2026-10-25)
// Card rolled on 2026-10-05 -> original due date is 2026-10-20 (< today 2026-10-25).
// Billed must be scheduled on Today (2026-10-25), while unbilled stays on 2026-11-20 (NOT pushed to 2026-12-20).
{
  const today = makeToday('2026-10-25');
  const minDate = '2026-10-25';
  const maxDate = '2027-10-24';

  const billedSched = resolveBilledCardSchedule(
    today,
    minDate,
    maxDate,
    5,
    20,
    '2026-10-05 08:00:00'
  );
  assert.deepEqual(billedSched, {
    originalDueDate: '2026-10-20',
    scheduledDate: '2026-10-25',
    isOverdue: true,
  });

  const unbilledSched = resolveUnbilledCardSchedule(
    today,
    minDate,
    maxDate,
    5,
    20,
    true,
    billedSched.originalDueDate,
    '2026-10-05 08:00:00'
  );
  assert.deepEqual(unbilledSched, {
    originalDueDate: '2026-11-20',
    scheduledDate: '2026-11-20',
    isOverdue: false,
  });
}

// 2. Cross-month due date overdue (statement_day = 20, payment_due_day = 5, today = 2026-10-12)
// Card rolled on 2026-09-20 -> original due date is 2026-10-05 (< today 2026-10-12).
// Billed must be scheduled on Today (2026-10-12), while unbilled stays on 2026-11-05 (from 2026-10-20 statement).
{
  const today = makeToday('2026-10-12');
  const minDate = '2026-10-12';
  const maxDate = '2027-10-11';

  const billedSched = resolveBilledCardSchedule(
    today,
    minDate,
    maxDate,
    20,
    5,
    '2026-09-20 08:00:00'
  );
  assert.deepEqual(billedSched, {
    originalDueDate: '2026-10-05',
    scheduledDate: '2026-10-12',
    isOverdue: true,
  });

  const unbilledSched = resolveUnbilledCardSchedule(
    today,
    minDate,
    maxDate,
    20,
    5,
    true,
    billedSched.originalDueDate,
    '2026-09-20 08:00:00'
  );
  assert.deepEqual(unbilledSched, {
    originalDueDate: '2026-11-05',
    scheduledDate: '2026-11-05',
    isOverdue: false,
  });
}

// 3. Cross-month BEFORE due date (statement_day = 20, payment_due_day = 5, today = 2026-10-03)
// Card has billed balance from 09/20 (due 2026-10-05, not overdue yet).
// Unbilled must be scheduled on 2026-11-05 (from 10/20 statement), NOT skipped to 2026-12-05.
{
  const today = makeToday('2026-10-03');
  const minDate = '2026-10-03';
  const maxDate = '2027-10-02';

  const billedSched = resolveBilledCardSchedule(
    today,
    minDate,
    maxDate,
    20,
    5,
    '2026-09-20 08:00:00'
  );
  assert.deepEqual(billedSched, {
    originalDueDate: '2026-10-05',
    scheduledDate: '2026-10-05',
    isOverdue: false,
  });

  const unbilledSched = resolveUnbilledCardSchedule(
    today,
    minDate,
    maxDate,
    20,
    5,
    true,
    billedSched.originalDueDate,
    '2026-09-20 08:00:00'
  );
  assert.deepEqual(unbilledSched, {
    originalDueDate: '2026-11-05',
    scheduledDate: '2026-11-05',
    isOverdue: false,
  });
}

// 4. Unrolled statement after statement day (statement_day = 5, payment_due_day = 20, rawBilled = 0, last_rollover_at = null)
// 4a. Today = 2026-10-12 (before due day 20): unbilled should map to 2026-10-20 (this month's due date).
// 4b. Today = 2026-10-25 (after due day 20): unbilled is overdue -> scheduled on Today (2026-10-25) with originalDueDate = 2026-10-20.
{
  const todayBeforeDue = makeToday('2026-10-12');
  const unbilledBeforeDue = resolveUnbilledCardSchedule(
    todayBeforeDue,
    '2026-10-12',
    '2027-10-11',
    5,
    20,
    false,
    null,
    null
  );
  assert.deepEqual(unbilledBeforeDue, {
    originalDueDate: '2026-10-20',
    scheduledDate: '2026-10-20',
    isOverdue: false,
  });

  const todayAfterDue = makeToday('2026-10-25');
  const unbilledAfterDue = resolveUnbilledCardSchedule(
    todayAfterDue,
    '2026-10-25',
    '2027-10-24',
    5,
    20,
    false,
    null,
    null
  );
  assert.deepEqual(unbilledAfterDue, {
    originalDueDate: '2026-10-20',
    scheduledDate: '2026-10-25',
    isOverdue: true,
  });
}

// 5. Rolled-over & ALREADY PAID statement after statement day (statement_day = 5, payment_due_day = 20, rawBilled = 0, last_rollover_at = '2026-10-05 12:00:00')
// Today = 2026-10-12: because this cycle was already rolled on 10/05 and paid off (rawBilled = 0), new unbilled charges belong to the 11/05 statement -> due 2026-11-20.
{
  const today = makeToday('2026-10-12');
  const unbilledPaidCycle = resolveUnbilledCardSchedule(
    today,
    '2026-10-12',
    '2027-10-11',
    5,
    20,
    false,
    null,
    '2026-10-05 12:00:00'
  );
  assert.deepEqual(unbilledPaidCycle, {
    originalDueDate: '2026-11-20',
    scheduledDate: '2026-11-20',
    isOverdue: false,
  });
}

// 6. Card without statement_day (statement_day = null, payment_due_day = 15)
// Today = 2026-10-20 -> originalDueDate = 2026-10-15, overdue -> scheduled on Today (2026-10-20).
{
  const today = makeToday('2026-10-20');
  const billedNoStmt = resolveBilledCardSchedule(
    today,
    '2026-10-20',
    '2027-10-19',
    null,
    15,
    null
  );
  assert.deepEqual(billedNoStmt, {
    originalDueDate: '2026-10-15',
    scheduledDate: '2026-10-20',
    isOverdue: true,
  });
}

// 7. parseRolloverTaipeiDate helper
{
  assert.equal(parseRolloverTaipeiDate(null), null);
  assert.equal(parseRolloverTaipeiDate('2026-10-05'), '2026-10-05');
  assert.equal(parseRolloverTaipeiDate('2026-10-05 01:00:00'), '2026-10-05');
}

console.log('All forecast_card_due.test.mjs assertions passed!');

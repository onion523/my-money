# 0043: Prior-Cycle Rollover Deferred-Only Inclusion & Historical Unbilled Settlement

- **Date**: 2026-11-15
- **Status**: Accepted (supersedes ADR-0030 §2 on non-deferred prior-cycle unbilled inclusion)
- **Related Issues**: #221, #222

## Context

Under ADR-0030, `GET /accounts/:id/rollover-preview` and `POST /accounts/:id/rollover-statement` pulled *all* transactions with `date <= prevStatementDate` and `is_billed = 0` into the current rollover candidate pool and labelled them `[上期延入]`, regardless of whether `defer_to_next_statement` was ever set to `1`. Users who had unbilled historical items that were never marked as deferred saw unexpected `[上期延入]` entries in subsequent statement rollovers.

## Decision

1. **Strict Prior-Cycle Deferred Filter**: `rollover-preview` and `rollover-statement` only include `date <= prevStatementDate` transactions when `(is_billed = 0 AND defer_to_next_statement = 1)` or `billed_statement_date = statementDate`.
2. **Exclude & Settle Non-Deferred Historical Unbilled Items**: Transactions with `date <= prevStatementDate AND is_billed = 0 AND defer_to_next_statement = 0` are excluded from `rollover-preview` and `projectedUnbilled`. When the user manually confirms rollover (`POST /accounts/:id/rollover-statement`) or manually calibrates (`POST /accounts/:id/reconcile`), these items are updated to `is_billed = 1, billed_statement_date = prevStatementDate`, moving them out of `unbilled` and into `balance` without triggering `findMatchingPriorCarryoverTxs`.
3. **Preserve Routine Auto-Reconcile Safety**: Automatic `reconcileCreditCardUnbilled` calls during normal transaction CRUD do not force `is_billed = 1`.

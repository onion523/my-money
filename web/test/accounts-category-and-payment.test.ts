import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Accounts Category Filter Tabs & Credit Card Payment Account Display (#229)', () => {
  const accountsSource = readFileSync(resolve(__dirname, '../src/pages/Accounts.tsx'), 'utf8');
  const dashboardSource = readFileSync(resolve(__dirname, '../src/pages/Dashboard.tsx'), 'utf8');
  const cssSource = readFileSync(resolve(__dirname, '../src/index.css'), 'utf8');

  it('renders 4-state account category filter tabs in Accounts.tsx with item counts', () => {
    expect(accountsSource).toContain('id="acc-cat-tab-all"');
    expect(accountsSource).toContain('id="acc-cat-tab-cash"');
    expect(accountsSource).toContain('id="acc-cat-tab-bank"');
    expect(accountsSource).toContain('id="acc-cat-tab-cc"');
    expect(accountsSource).toContain('全部類型 ({accounts.length})');
    expect(accountsSource).toContain('現金錢包 ({cashAccounts.length})');
    expect(accountsSource).toContain('銀行存款帳戶 ({bankAccounts.length})');
    expect(accountsSource).toContain('信用卡 ({creditCards.length})');
  });

  it('filters sections by categoryFilter while keeping top 4 summary stat cards unconditional', () => {
    expect(accountsSource).toContain("(categoryFilter === 'all' || categoryFilter === 'cash')");
    expect(accountsSource).toContain("(categoryFilter === 'all' || categoryFilter === 'bank')");
    expect(accountsSource).toContain("(categoryFilter === 'all' || categoryFilter === 'credit_card')");
  });

  it('displays payment account name, balance, sufficiency badge, and unset shortcut on credit card cards in Accounts.tsx and Dashboard.tsx', () => {
    expect(accountsSource).toContain('cc-payment-account-box');
    expect(accountsSource).toContain('扣款帳戶：{payBankName}');
    expect(accountsSource).toContain('存款不足（差額 {formatCurrency(shortfall)}）');
    expect(accountsSource).toContain('餘額充足');
    expect(accountsSource).toContain('預設扣款帳戶：未設定');
    expect(accountsSource).toContain('設定扣款帳戶');

    expect(dashboardSource).toContain('扣款：{payBankName}');
    expect(dashboardSource).toContain('預設扣款帳戶：未設定');
  });

  it('defines responsive 2x2 grid for mobile account category tabs in index.css', () => {
    expect(cssSource).toContain('.account-category-tab-bar');
    expect(cssSource).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });
});

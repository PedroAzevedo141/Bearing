import { describe, it, expect } from 'vitest';
import { isNameSimilar, findMatchingInstallment } from './statementMatching';
import type { ParsedStatementItem, InstallmentPurchase } from '../types';

describe('statementService', () => {
  describe('isNameSimilar', () => {
    it('matches identical strings', () => {
      expect(isNameSimilar('Notebook Dell', 'Notebook Dell')).toBe(true);
    });
    
    it('matches strings with different cases and whitespace', () => {
      expect(isNameSimilar('  NOTEBOOK DELL  ', 'notebook dell')).toBe(true);
    });

    it('matches if one shares significant words with the other', () => {
      expect(isNameSimilar('Compra Parcelada Notebook', 'Notebook')).toBe(true);
      expect(isNameSimilar('Mercado Extra', 'Extra')).toBe(true);
    });

    it('does not match unrelated strings', () => {
      expect(isNameSimilar('Mercado', 'Farmacia')).toBe(false);
      expect(isNameSimilar('Uber', 'Ifood')).toBe(false);
    });
  });

  describe('findMatchingInstallment', () => {
    const activeInstallments: InstallmentPurchase[] = [
      {
        id: '1',
        name: 'Notebook Dell',
        tag_id: null,
        total_amount_cents: 18000, // 6x 30.00
        installment_count: 6,
        current_installment: 1,
        first_due_date: 1000,
        created_at: 1000,
      },
      {
        id: '2',
        name: 'Mercado Livre',
        tag_id: null,
        total_amount_cents: 20000, // 4x 50.00
        installment_count: 4,
        current_installment: 2,
        first_due_date: 1000,
        created_at: 1000,
      }
    ];

    it('matches exactly identical amount, count and similar name', () => {
      const item: ParsedStatementItem = {
        description: 'PGTO NOTEBOOK',
        amount_cents: 3000,
        type: 'expense',
        occurred_at: 1000,
        is_installment: true,
        installment_current: 2,
        installment_total: 6,
      };

      const match = findMatchingInstallment(item, activeInstallments);
      expect(match).toBeDefined();
      expect(match?.id).toBe('1');
    });

    it('does not match if amount is completely off', () => {
      const item: ParsedStatementItem = {
        description: 'NOTEBOOK',
        amount_cents: 5000,
        type: 'expense',
        occurred_at: 1000,
        is_installment: true,
        installment_current: 2,
        installment_total: 6,
      };

      const match = findMatchingInstallment(item, activeInstallments);
      expect(match).toBeUndefined();
    });
    
    it('does not match if name is completely different despite same amount', () => {
      const item: ParsedStatementItem = {
        description: 'Tênis',
        amount_cents: 3000,
        type: 'expense',
        occurred_at: 1000,
        is_installment: true,
        installment_current: 2,
        installment_total: 6,
      };

      const match = findMatchingInstallment(item, activeInstallments);
      expect(match).toBeUndefined();
    });
  });
});

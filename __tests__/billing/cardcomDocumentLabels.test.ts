import {
  cardcomDocumentTypeLabelHe,
  paymentStatusLabelHe,
} from '../../utils/cardcomDocumentLabels';

describe('cardcomDocumentLabels', () => {
  it('maps common CardCom document types to Hebrew', () => {
    expect(cardcomDocumentTypeLabelHe('TaxInvoiceAndReceipt')).toBe('חשבונית מס / קבלה');
    expect(cardcomDocumentTypeLabelHe('Receipt')).toBe('קבלה');
    expect(cardcomDocumentTypeLabelHe('TaxInvoice')).toBe('חשבונית מס');
  });

  it('returns null for empty type and falls back to raw for unknown', () => {
    expect(cardcomDocumentTypeLabelHe(null)).toBeNull();
    expect(cardcomDocumentTypeLabelHe('')).toBeNull();
    expect(cardcomDocumentTypeLabelHe('CustomTypeX')).toBe('CustomTypeX');
  });

  it('maps payment statuses for billing UI', () => {
    expect(paymentStatusLabelHe('success')).toBe('שולם');
    expect(paymentStatusLabelHe('refunded')).toBe('הוחזר');
    expect(paymentStatusLabelHe('pending_charge')).toBe('ממתין לחיוב');
  });
});

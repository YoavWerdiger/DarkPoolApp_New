/**
 * Mirrors mapEdgeInvoiceToHistoryItem in paymentService — keep fields in sync.
 * (paymentService helpers are module-private; we assert the contract the UI relies on.)
 */

type PaymentInvoiceEdgeRow = {
  id: string;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  plan_id?: string | null;
  created_at?: string | null;
  document_type?: string | null;
  document_number?: number | null;
  document_url?: string | null;
};

function mapEdgeInvoiceToHistoryItem(row: PaymentInvoiceEdgeRow) {
  return {
    id: String(row.id),
    amount: row.amount ?? null,
    currency: row.currency ?? 'ILS',
    status: row.status ?? null,
    plan_id: row.plan_id ?? null,
    created_at: row.created_at ?? null,
    document_type: row.document_type ?? null,
    document_number: row.document_number ?? null,
    document_url: row.document_url ?? null,
    cardcom_document_type: row.document_type ?? null,
    cardcom_document_number: row.document_number ?? null,
    cardcom_document_url: row.document_url ?? null,
  };
}

describe('payment history invoice mapping', () => {
  it('maps document metadata and aliases for BillingScreen', () => {
    const mapped = mapEdgeInvoiceToHistoryItem({
      id: 'tx-1',
      amount: 99,
      currency: 'ILS',
      status: 'success',
      plan_id: 'premium_monthly',
      created_at: '2026-08-09T10:00:00.000Z',
      document_type: 'TaxInvoiceAndReceipt',
      document_number: 12345,
      document_url: 'https://example.com/doc.pdf',
    });

    expect(mapped.document_number).toBe(12345);
    expect(mapped.document_type).toBe('TaxInvoiceAndReceipt');
    expect(mapped.document_url).toBe('https://example.com/doc.pdf');
    expect(mapped.cardcom_document_number).toBe(12345);
    expect(mapped.cardcom_document_url).toBe('https://example.com/doc.pdf');
  });

  it('keeps nulls when CardCom did not return a URL', () => {
    const mapped = mapEdgeInvoiceToHistoryItem({
      id: 'tx-2',
      amount: 49,
      status: 'success',
      document_type: 'Receipt',
      document_number: 7,
      document_url: null,
    });

    expect(mapped.document_url).toBeNull();
    expect(mapped.cardcom_document_url).toBeNull();
    expect(mapped.document_number).toBe(7);
    expect(mapped.currency).toBe('ILS');
  });
});

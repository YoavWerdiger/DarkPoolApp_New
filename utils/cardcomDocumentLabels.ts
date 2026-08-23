/** Hebrew labels for CardCom DocumentType values shown to end users. */
const DOCUMENT_TYPE_HE: Record<string, string> = {
  TaxInvoiceAndReceipt: 'חשבונית מס / קבלה',
  TaxInvoiceAndReceiptRefund: 'חשבונית זכות / החזר',
  TaxInvoice: 'חשבונית מס',
  TaxInvoiceRefund: 'חשבונית מס זכות',
  Receipt: 'קבלה',
  ReceiptRefund: 'קבלה זכות',
  ReceiptForTaxInvoice: 'קבלה לחשבונית מס',
  ReceiptForTaxInvoiceRefund: 'זיכוי קבלה לחשבונית',
  DonationReceipt: 'קבלה לתרומה',
  DonationReceiptRefund: 'זיכוי קבלה לתרומה',
  ProformaInvoice: 'חשבונית עסקה',
  ProformaInvoiceRefund: 'זיכוי חשבונית עסקה',
  ProformaDealInvoice: 'קבלה לעסקת פרופורמה',
  ProformaDealInvoiceRefund: 'זיכוי קבלה לפרופורמה',
  DemandForPayment: 'דרישת תשלום',
  DemandForPaymentRefund: 'ביטול דרישת תשלום',
  Quote: 'הצעת מחיר',
  Order: 'הזמנה',
  OrderConfirmation: 'אישור הזמנה',
  OrderConfirmationRefund: 'זיכוי אישור הזמנה',
  DeliveryNote: 'תעודת משלוח',
  DeliveryNoteRefund: 'תעודת החזרה',
  Auto: 'מסמך',
};

export function cardcomDocumentTypeLabelHe(
  documentType: string | null | undefined,
): string | null {
  if (!documentType) return null;
  const key = String(documentType).trim();
  if (!key) return null;
  return DOCUMENT_TYPE_HE[key] ?? key;
}

export function paymentStatusLabelHe(status: string | null | undefined): string {
  switch (status) {
    case 'success':
      return 'שולם';
    case 'failed':
      return 'נכשל';
    case 'pending':
      return 'ממתין';
    case 'pending_charge':
      return 'ממתין לחיוב';
    case 'refunded':
      return 'הוחזר';
    case 'cancelled':
      return 'בוטל';
    default:
      return status ? String(status) : '—';
  }
}

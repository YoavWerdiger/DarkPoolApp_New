import i18n from '../lib/i18n';
/** Hebrew labels for CardCom DocumentType values shown to end users. */
const DOCUMENT_TYPE_HE: Record<string, string> = {
  TaxInvoiceAndReceipt: i18n.t('auto.utils__cardcomDocumentLabels.s1'),
  TaxInvoiceAndReceiptRefund: i18n.t('auto.utils__cardcomDocumentLabels.s2'),
  TaxInvoice: i18n.t('auto.utils__cardcomDocumentLabels.s3'),
  TaxInvoiceRefund: i18n.t('auto.utils__cardcomDocumentLabels.s4'),
  Receipt: i18n.t('auto.utils__cardcomDocumentLabels.s5'),
  ReceiptRefund: i18n.t('auto.utils__cardcomDocumentLabels.s6'),
  ReceiptForTaxInvoice: i18n.t('auto.utils__cardcomDocumentLabels.s7'),
  ReceiptForTaxInvoiceRefund: i18n.t('auto.utils__cardcomDocumentLabels.s8'),
  DonationReceipt: i18n.t('auto.utils__cardcomDocumentLabels.s9'),
  DonationReceiptRefund: i18n.t('auto.utils__cardcomDocumentLabels.s10'),
  ProformaInvoice: i18n.t('auto.utils__cardcomDocumentLabels.s11'),
  ProformaInvoiceRefund: i18n.t('auto.utils__cardcomDocumentLabels.s12'),
  ProformaDealInvoice: i18n.t('auto.utils__cardcomDocumentLabels.s13'),
  ProformaDealInvoiceRefund: i18n.t('auto.utils__cardcomDocumentLabels.s14'),
  DemandForPayment: i18n.t('auto.utils__cardcomDocumentLabels.s15'),
  DemandForPaymentRefund: i18n.t('auto.utils__cardcomDocumentLabels.s16'),
  Quote: i18n.t('auto.utils__cardcomDocumentLabels.s17'),
  Order: i18n.t('auto.utils__cardcomDocumentLabels.s18'),
  OrderConfirmation: i18n.t('auto.utils__cardcomDocumentLabels.s19'),
  OrderConfirmationRefund: i18n.t('auto.utils__cardcomDocumentLabels.s20'),
  DeliveryNote: i18n.t('auto.utils__cardcomDocumentLabels.s21'),
  DeliveryNoteRefund: i18n.t('auto.utils__cardcomDocumentLabels.s22'),
  Auto: i18n.t('auto.utils__cardcomDocumentLabels.s23'),
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
      return i18n.t('auto.utils__cardcomDocumentLabels.s24');
    case 'failed':
      return i18n.t('auto.utils__cardcomDocumentLabels.s25');
    case 'pending':
      return i18n.t('auto.utils__cardcomDocumentLabels.s26');
    case 'pending_charge':
      return i18n.t('auto.utils__cardcomDocumentLabels.s27');
    case 'refunded':
      return i18n.t('auto.utils__cardcomDocumentLabels.s28');
    case 'cancelled':
      return i18n.t('auto.utils__cardcomDocumentLabels.s29');
    default:
      return status ? String(status) : '—';
  }
}

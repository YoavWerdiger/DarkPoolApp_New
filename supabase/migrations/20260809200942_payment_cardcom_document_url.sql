-- Persist CardCom document PDF/view URL on payment_transactions.
-- Populated from GetLpResult.DocumentInfo.DocumentUrl when present,
-- or via Documents/CreateDocumentUrl (DocUrl) after a successful charge.

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS cardcom_document_url text;

COMMENT ON COLUMN public.payment_transactions.cardcom_document_url IS
  'Public CardCom document view/PDF URL (from DocumentInfo.DocumentUrl or Documents/CreateDocumentUrl). Safe to show to the owning user; never expose ApiPassword.';

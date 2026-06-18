-- מאפשר ON CONFLICT (source, external_id) ב-sync-insider-buys.
-- האינדקס החלקי (WHERE external_id IS NOT NULL) לא נתמך ב-ON CONFLICT.

DROP INDEX IF EXISTS public.uq_dpi_external;

UPDATE public.dark_pool_insider_buys
   SET external_id = 'legacy:' || id::text
 WHERE external_id IS NULL;

ALTER TABLE public.dark_pool_insider_buys
  ALTER COLUMN external_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dpi_source_external_id
  ON public.dark_pool_insider_buys (source, external_id);

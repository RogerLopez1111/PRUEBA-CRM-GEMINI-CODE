-- add-meta-utilidad.sql
-- Adds the "meta de utilidad" (gross-profit goal) alongside the existing sales
-- goal in vendedor_metas. The sales goal stays in `meta`; the new column holds
-- the monthly utilidad-bruta target. Progreso de utilidad compares this against
-- the real utilidad from erp_rentabilidad_vendedor_mensual (ManagementPro RPVNA06).
--
-- Run once in the Supabase SQL editor.

alter table vendedor_metas
  add column if not exists meta_utilidad numeric not null default 0;

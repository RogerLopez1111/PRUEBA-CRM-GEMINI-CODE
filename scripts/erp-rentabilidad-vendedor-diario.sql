-- erp_rentabilidad_vendedor_diario
-- Daily-grain twin of erp_rentabilidad_vendedor_mensual — one row per
-- (vendedor, día). Rebuilt over a rolling window each ERP→Supabase sync from the
-- SQL Server Venta + Nota_Credito tables; reads work on the Vercel build (no ERP
-- API call). Same faithful RPVNA06 port as the monthly table, only the date is
-- truncated to the day (CONVERT char(10)) instead of the month (char(7)).
--
--   venta_importe = SUM((Vn_Precio_Descontado_Importe - Vn_Descuento_Global_Importe) * Vn_Tipo_Cambio)
--   venta_costo   = SUM(Vn_Costo_Importe)
--   dev_*         = same, from Nota_Credito where Nc_Tabla IN ('ACUSE_RECIBO','DEVOLUCION_CLIENTE')
--   boni_importe  = same importe expr, from Nota_Credito where Nc_Tabla NOT IN (...)
--   filtro        = Es_Cve_Estado <> 'CA'
-- Net profitability is derived at read time (same formulas as the monthly table):
--   importe_neto = venta_importe - dev_importe - boni_importe
--   costo_neto   = venta_costo   - dev_costo
--   utilidad     = importe_neto  - costo_neto ;  % = utilidad / importe_neto
-- Amounts are in base currency (pesos) via tipo de cambio.
--
-- Daily rows are ~30× the monthly volume, so the sync only keeps a bounded
-- rolling window (see DIARIO_DAYS_BACK in sync-erp.ts), not the full history.
--
-- Run once in the Supabase SQL editor.

create table if not exists erp_rentabilidad_vendedor_diario (
  vendedor_id     text        not null,
  vendedor_nombre text        not null default '',
  fecha           date        not null,                 -- 'YYYY-MM-DD'
  venta_importe   numeric     not null default 0,
  venta_costo     numeric     not null default 0,
  dev_importe     numeric     not null default 0,
  dev_costo       numeric     not null default 0,
  boni_importe    numeric     not null default 0,
  synced_at       timestamptz not null default now(),
  primary key (vendedor_id, fecha)
);

-- Read path: range scan over fecha (e.g. one month / one vendedor's trend).
create index if not exists erp_rvd_fecha
  on erp_rentabilidad_vendedor_diario (fecha);

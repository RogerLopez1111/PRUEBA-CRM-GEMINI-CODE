-- erp_rentabilidad_vendedor_mensual
-- Materialized "REPORTE DE RENTABILIDAD" (agrupado por Vendedor) — one row per
-- (vendedor, mes). Rebuilt every ERP→Supabase sync from the SQL Server Venta +
-- Nota_Credito tables; the report tab reads ONLY this table (no ERP API call, so
-- it works on the Vercel build). Pivot `periodo` into ENE…DIC at read time.
--
-- Faithful port of ManagementPro RPVNA06 (RPVNA06_CO.asp), Agrupar = "36":
--   venta_importe = SUM((Vn_Precio_Descontado_Importe - Vn_Descuento_Global_Importe) * Vn_Tipo_Cambio)
--   venta_costo   = SUM(Vn_Costo_Importe)
--   dev_*         = same, from Nota_Credito where Nc_Tabla IN ('ACUSE_RECIBO','DEVOLUCION_CLIENTE')
--   boni_importe  = same importe expr, from Nota_Credito where Nc_Tabla NOT IN (...)
--   filtro        = Es_Cve_Estado <> 'CA'   (no solo FA)
-- Net profitability is derived at read time (rentabilidad-core.ts):
--   importe_neto = venta_importe - dev_importe - boni_importe
--   costo_neto   = venta_costo   - dev_costo
--   utilidad     = importe_neto  - costo_neto ;  % = utilidad / importe_neto
-- Merma & Gasto are excluded (the ERP disables both for the Vendedor grouping).
-- Amounts are in base currency (pesos) via tipo de cambio.
--
-- Run once in the Supabase SQL editor.

create table if not exists erp_rentabilidad_vendedor_mensual (
  vendedor_id     text        not null,
  vendedor_nombre text        not null default '',
  periodo         text        not null,                 -- 'YYYY-MM'
  venta_importe   numeric     not null default 0,
  venta_costo     numeric     not null default 0,
  dev_importe     numeric     not null default 0,
  dev_costo       numeric     not null default 0,
  boni_importe    numeric     not null default 0,
  synced_at       timestamptz not null default now(),
  primary key (vendedor_id, periodo)
);

-- Read path: whole-year scan, grouped by vendedor in JS.
create index if not exists erp_rvm_periodo
  on erp_rentabilidad_vendedor_mensual (periodo);

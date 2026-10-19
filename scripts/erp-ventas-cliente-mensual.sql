-- erp_ventas_cliente_mensual
-- Materialized "REPORTE ANALÍTICO DE VENTAS ANUAL (CLIENTE)" — one row per
-- (vendedor que vendió, cliente, mes). Rebuilt every ERP→Supabase sync from the
-- SQL Server Venta table; the report tab reads ONLY this table (no ERP API call,
-- works on the Vercel build). Pivot `periodo` into ENE…DIC at read time and group
-- by segmento to reproduce the ManagementPro report.
--
-- Semantics (validated to the peso against the MP report, 2026):
--   importe   = SUM(Vn_Precio_Descontado_Importe)  -- sin IVA, precio tras descuento
--   filtro    = Es_Cve_Estado = 'FA' (facturado)
--   vendedor  = Venta.Vn_Cve_Vendedor  (quien hizo la venta)
--   segmento  = Cliente.Sg_Cve_Segmento (segmento actual del cliente)
-- Clients with no sales in a period simply have no row (the report omits zeros).
--
-- Run once in the Supabase SQL editor.

create table if not exists erp_ventas_cliente_mensual (
  vendedor_id     text        not null,
  vendedor_nombre text        not null default '',
  segmento_id     text        not null default '',
  segmento_nombre text        not null default '',
  cliente_id      text        not null,
  cliente_nombre  text        not null default '',
  razon_social    text        not null default '',
  periodo         text        not null,                 -- 'YYYY-MM'
  importe         numeric     not null default 0,        -- SUM(Vn_Precio_Descontado_Importe), sin IVA, FA
  synced_at       timestamptz not null default now(),
  primary key (vendedor_id, cliente_id, periodo)
);

-- Read path: filter by vendedor + año, group by segmento.
create index if not exists erp_vcm_vendedor_periodo
  on erp_ventas_cliente_mensual (vendedor_id, periodo);

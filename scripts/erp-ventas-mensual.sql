-- erp_ventas_mensual
-- Per-seller MONTHLY ERP sales aggregate — the calculated amount only, never the
-- raw ventas rows. Written whenever a user on the office LAN reads the ERP
-- (/api/performance/ventas), so any LAN read "tops up" this table; read by ALL
-- builds (including the Vercel web build, which can't reach the LAN ERP) to show
-- Progreso Meta vs real sales.
--
-- Run once in the Supabase SQL editor.

create table if not exists erp_ventas_mensual (
  vendedor_id text        not null,
  periodo     text        not null,                 -- 'YYYY-MM'
  subtotal    numeric     not null default 0,       -- sum totales.subtotal (sin IVA) — the sales value
  total       numeric     not null default 0,       -- sum totales.total (con IVA) — reference
  facturas    integer     not null default 0,       -- count of estatus=FA docs
  updated_at  timestamptz not null default now(),
  primary key (vendedor_id, periodo)
);

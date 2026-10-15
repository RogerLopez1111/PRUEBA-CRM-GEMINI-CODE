-- add-indexes.sql
-- One-time performance fix: add secondary indexes for the columns the CRM API
-- filters and sorts on. Without these, every query below is a full-table scan,
-- which is what produces the "57014 canceling statement due to statement
-- timeout" bursts in the Supabase logs under concurrent load.
--
-- HOW TO RUN (Supabase dashboard → SQL editor):
--   Run each statement. CREATE INDEX CONCURRENTLY cannot run inside a
--   transaction block, so if you paste the whole file and get an error like
--   "CREATE INDEX CONCURRENTLY cannot run inside a transaction block", run the
--   statements ONE AT A TIME instead. Re-running is safe (IF NOT EXISTS).
--
-- CONCURRENTLY = builds the index without locking the table against writes, so
-- sellers can keep uploading leads while it runs.

-- leads: scoped per-seller reads, status filters, client joins, task links, sort
create index concurrently if not exists idx_leads_vendedor
  on public.leads ("Vn_Cve_Vendedor");
create index concurrently if not exists idx_leads_status
  on public.leads ("Cl_Status_CRM");
create index concurrently if not exists idx_leads_cliente
  on public.leads ("Cl_Cve_Cliente");
create index concurrently if not exists idx_leads_tarea
  on public.leads (tarea_id);
create index concurrently if not exists idx_leads_createdat
  on public.leads ("Cl_CreatedAt_CRM" desc);

-- clientes: the ORDER BY column for /api/clients (the biggest offender — a
-- 50k-row sort repeated on every page of OFFSET pagination)
create index concurrently if not exists idx_clientes_razon
  on public.clientes ("Cl_Razon_Social");

-- productos: ORDER BY + active-only filter for /api/productos
create index concurrently if not exists idx_productos_desc
  on public.productos ("Pr_Descripcion");
create index concurrently if not exists idx_productos_estado
  on public.productos ("Es_Cve_Estado");

-- join / lookup tables used to assemble tareas, metas, faltantes, pedidos
create index concurrently if not exists idx_tarea_asig_vendedor
  on public.tarea_asignados (vendedor_id);
create index concurrently if not exists idx_tarea_asig_tarea
  on public.tarea_asignados (tarea_id);
create index concurrently if not exists idx_metas_vendedor
  on public.vendedor_metas ("Vn_Cve_Vendedor");
create index concurrently if not exists idx_faltantes_vendedor
  on public.productos_faltantes ("Vn_Cve_Vendedor");
create index concurrently if not exists idx_pedidos_vendedor
  on public.pedidos_extraordinarios ("Vn_Cve_Vendedor");

-- Refresh planner statistics so the new indexes get used immediately.
analyze public.leads;
analyze public.clientes;
analyze public.productos;
analyze public.tarea_asignados;
analyze public.vendedor_metas;
analyze public.productos_faltantes;
analyze public.pedidos_extraordinarios;

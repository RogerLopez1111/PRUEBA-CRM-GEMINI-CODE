/**
 * sync-erp.ts
 * Mirrors ERP (SQL Server ECO_2020) into Supabase so Vercel always has fresh data.
 *
 * Run manually:  npx tsx scripts/sync-erp.ts
 * Or scheduled:  add a Windows Task Scheduler job to run it periodically
 *
 * What it does:
 *  - sucursales / segmentos: upsert all ERP rows
 *  - clientes: upsert all ERP rows, then delete ERP-style IDs in Supabase
 *    that no longer exist in ERP (skipping any that still have leads)
 *  - CRM prospects (alphanumeric IDs) are never touched
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import {
  getSucursales,
  getSegmentos,
  getVendedores,
  getErpClients,
  getErpClientsRaw,
  getProductosRaw,
} from '../src/sqlserver.js';

// Sync runs locally / via scheduler with full DB access. Uses the service role
// key so it can write to every mirrored table even after RLS is enabled.
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ERP IDs are all-numeric (e.g. "0000000180"); CRM prospect IDs are random alphanumeric
const isErpId = (id: string) => /^\d+$/.test(id);

// ---------------------------------------------------------------------------
// Sucursales
// ---------------------------------------------------------------------------
async function syncSucursales() {
  const rows = await getSucursales();
  if (!rows.length) { console.warn('⚠  No sucursales returned from SQL Server'); return; }

  const { error } = await supabase.from('sucursales').upsert(
    rows.map((s) => ({
      Sc_Cve_Sucursal: s.id,
      Sc_Descripcion: s.name,
      Es_Cve_Estado: s.estado,
    })),
    { onConflict: 'Sc_Cve_Sucursal' }
  );
  if (error) { console.error('✗ sucursales:', error.message); return; }
  console.log(`✓ sucursales upserted: ${rows.length}`);
}

// ---------------------------------------------------------------------------
// Segmentos
// ---------------------------------------------------------------------------
async function syncSegmentos() {
  const rows = await getSegmentos();
  if (!rows.length) { console.warn('⚠  No segmentos returned from SQL Server'); return; }

  const { error } = await supabase.from('segmentos').upsert(
    rows.map((s) => ({
      Sg_Cve_Segmento: s.id,
      Sg_Descripcion: s.name,
      Es_Cve_Estado: s.estado,
    })),
    { onConflict: 'Sg_Cve_Segmento' }
  );
  if (error) { console.error('✗ segmentos:', error.message); return; }
  console.log(`✓ segmentos upserted: ${rows.length}`);
}

// ---------------------------------------------------------------------------
// Vendedores — upsert ERP identity fields only (CRM owns Vn_Perfil / Vn_Password)
// ---------------------------------------------------------------------------
async function syncVendedores() {
  const rows = await getVendedores();
  if (!rows.length) { console.warn('⚠  No vendedores returned from SQL Server'); return; }

  const { error } = await supabase.from('vendedores').upsert(
    rows.map((v) => ({
      Vn_Cve_Vendedor: v.id,
      Vn_Descripcion: v.name,
      Vn_Email: v.email,
      Sc_Cve_Sucursal: v.sucursalId,
      Es_Cve_Estado: v.estado,
    })),
    { onConflict: 'Vn_Cve_Vendedor' }
  );
  if (error) { console.error('✗ vendedores:', error.message); return; }
  console.log(`✓ vendedores upserted: ${rows.length}`);

  // Remove ERP-style vendedores in Supabase that are no longer active in ERP,
  // skipping any still referenced by leads or goals (FK constraints).
  // CRM-created users (alphanumeric IDs) are never touched — they're created
  // for CRM-only roles like Compras and have no ERP counterpart.
  const activeIds = new Set(rows.map((r) => r.id));
  const { data: existing } = await supabase.from('vendedores').select('Vn_Cve_Vendedor');
  const orphans = (existing || [])
    .map((r) => String(r.Vn_Cve_Vendedor))
    .filter((id) => isErpId(id) && !activeIds.has(id));
  if (!orphans.length) return;

  const [{ data: leadRefs }, { data: goalRefs }] = await Promise.all([
    supabase.from('leads').select('Vn_Cve_Vendedor').in('Vn_Cve_Vendedor', orphans),
    supabase.from('vendedor_metas').select('Vn_Cve_Vendedor').in('Vn_Cve_Vendedor', orphans),
  ]);
  const referenced = new Set([
    ...(leadRefs || []).map((r) => String(r.Vn_Cve_Vendedor)),
    ...(goalRefs || []).map((r) => String(r.Vn_Cve_Vendedor)),
  ]);
  const safeToDelete = orphans.filter((id) => !referenced.has(id));
  const skipped = orphans.filter((id) => referenced.has(id));

  if (safeToDelete.length) {
    const { error: delErr } = await supabase.from('vendedores').delete().in('Vn_Cve_Vendedor', safeToDelete);
    if (delErr) console.error('✗ vendedores delete:', delErr.message);
    else console.log(`✓ vendedores deleted: ${safeToDelete.length} inactive`);
  }
  if (skipped.length) {
    console.warn(`⚠  ${skipped.length} inactive vendedores kept because leads/metas still reference them: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Clients — full-column mirror of ERP Cliente → Supabase clientes
// ---------------------------------------------------------------------------

// Columns where the Supabase schema is NOT NULL but ERP allows NULL.
// Coerce null → '' so the sync doesn't fail on those rows. Remove entries
// once the Supabase column is altered to allow NULL (see README / migration).
const NOT_NULL_TEXT_COLUMNS = new Set<string>([
  'Cl_Razon_Social',
  'Cl_Razon_Social_2',
  'Cl_Cve_Maestro',
]);

// Normalize one ERP row for Supabase:
//  - Date  → ISO string (Supabase timestamp columns accept ISO)
//  - string → trimmed (SQL Server char/nchar columns are space-padded)
//  - null on NOT_NULL_TEXT_COLUMNS → '' so NOT-NULL constraints are satisfied
function normalizeErpRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (typeof v === 'string') {
      out[k] = v.trim();
    } else if (v === null && NOT_NULL_TEXT_COLUMNS.has(k)) {
      out[k] = '';
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function syncClients() {
  const rawRows = await getErpClientsRaw();
  if (!rawRows.length) { console.warn('⚠  No clients returned from SQL Server'); return; }

  // 1) Upsert every column from ERP → Supabase (same schema, same data)
  const CHUNK = 200;
  let upserted = 0;
  for (let i = 0; i < rawRows.length; i += CHUNK) {
    const chunk = rawRows.slice(i, i + CHUNK).map(normalizeErpRow);
    const { error } = await supabase.from('clientes').upsert(chunk, { onConflict: 'Cl_Cve_Cliente' });
    if (error) { console.error(`✗ clients chunk ${i}–${i + chunk.length}:`, error.message); }
    else upserted += chunk.length;
  }
  console.log(`✓ clients upserted: ${upserted} / ${rawRows.length}`);

  // 2) Collect all ERP-style IDs currently in Supabase (paginate to bypass max-rows cap)
  const supabaseErpIds = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('clientes')
      .select('Cl_Cve_Cliente')
      .range(from, from + PAGE - 1);
    if (error) { console.error('✗ clients fetch for diff:', error.message); return; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      if (isErpId(row.Cl_Cve_Cliente)) supabaseErpIds.add(row.Cl_Cve_Cliente);
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // 3) Find IDs in Supabase that no longer exist in ERP
  const erpIdSet = new Set(rawRows.map((c) => String(c.Cl_Cve_Cliente)));
  const orphanIds = [...supabaseErpIds].filter((id) => !erpIdSet.has(id));
  if (orphanIds.length === 0) {
    console.log('✓ clients: no orphans to delete');
    return;
  }

  // 4) Check which orphans still have leads — we can't delete those (FK)
  const { data: refs } = await supabase
    .from('leads')
    .select('Cl_Cve_Cliente')
    .in('Cl_Cve_Cliente', orphanIds);
  const referenced = new Set((refs || []).map((r) => r.Cl_Cve_Cliente));
  const safeToDelete = orphanIds.filter((id) => !referenced.has(id));
  const skipped = orphanIds.filter((id) => referenced.has(id));

  // 5) Delete the safe ones in chunks
  let deleted = 0;
  for (let i = 0; i < safeToDelete.length; i += CHUNK) {
    const ids = safeToDelete.slice(i, i + CHUNK);
    const { error } = await supabase.from('clientes').delete().in('Cl_Cve_Cliente', ids);
    if (error) console.error(`✗ clients delete chunk ${i}:`, error.message);
    else deleted += ids.length;
  }
  console.log(`✓ clients deleted: ${deleted} orphaned ERP ids`);
  if (skipped.length) {
    console.warn(`⚠  ${skipped.length} orphaned ERP clients kept because leads still reference them: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Productos — Tier-1 column subset mirror of ERP Producto
// ---------------------------------------------------------------------------
async function syncProductos() {
  const rawRows = await getProductosRaw();
  if (!rawRows.length) { console.warn('⚠  No productos returned from SQL Server'); return; }

  const CHUNK = 500;
  let upserted = 0;
  for (let i = 0; i < rawRows.length; i += CHUNK) {
    const chunk = rawRows.slice(i, i + CHUNK).map(normalizeErpRow);
    const { error } = await supabase.from('productos').upsert(chunk, { onConflict: 'Pr_Cve_Producto' });
    if (error) console.error(`✗ productos chunk ${i}–${i + chunk.length}:`, error.message);
    else upserted += chunk.length;
  }
  console.log(`✓ productos upserted: ${upserted} / ${rawRows.length}`);

  // Delete productos in Supabase that no longer exist in ERP, skipping any
  // still referenced by productos_faltantes rows (FK constraint).
  const erpIdSet = new Set(rawRows.map((r) => String(r.Pr_Cve_Producto)));

  const supabaseIds: string[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('productos')
      .select('Pr_Cve_Producto')
      .range(from, from + PAGE - 1);
    if (error) { console.error('✗ productos fetch for diff:', error.message); return; }
    if (!data || data.length === 0) break;
    for (const row of data) supabaseIds.push(String(row.Pr_Cve_Producto));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const orphans = supabaseIds.filter((id) => !erpIdSet.has(id));
  if (!orphans.length) { console.log('✓ productos: no orphans to delete'); return; }

  const { data: refs } = await supabase
    .from('productos_faltantes')
    .select('Pr_Cve_Producto')
    .in('Pr_Cve_Producto', orphans);
  const referenced = new Set((refs || []).map((r) => String(r.Pr_Cve_Producto)));
  const safeToDelete = orphans.filter((id) => !referenced.has(id));
  const skipped = orphans.filter((id) => referenced.has(id));

  let deleted = 0;
  for (let i = 0; i < safeToDelete.length; i += CHUNK) {
    const ids = safeToDelete.slice(i, i + CHUNK);
    const { error } = await supabase.from('productos').delete().in('Pr_Cve_Producto', ids);
    if (error) console.error(`✗ productos delete chunk ${i}:`, error.message);
    else deleted += ids.length;
  }
  console.log(`✓ productos deleted: ${deleted} orphaned ERP ids`);
  if (skipped.length) {
    console.warn(`⚠  ${skipped.length} orphaned productos kept because productos_faltantes still references them: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n── ERP → Supabase sync  ${new Date().toLocaleString()} ──`);
  await syncSucursales();
  await syncSegmentos();
  await syncVendedores();
  await syncClients();
  await syncProductos();
  console.log('── done ──\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});

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
  getErpClients,
} from '../src/sqlserver.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
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
// Clients — upsert all ERP rows, then delete orphaned ERP-style IDs
// ---------------------------------------------------------------------------
async function syncClients() {
  const erpClients = await getErpClients();
  if (!erpClients.length) { console.warn('⚠  No clients returned from SQL Server'); return; }

  // 1) Upsert in chunks
  const CHUNK = 200;
  let upserted = 0;
  for (let i = 0; i < erpClients.length; i += CHUNK) {
    const chunk = erpClients.slice(i, i + CHUNK);
    const { error } = await supabase.from('clientes').upsert(
      chunk.map((c) => ({
        Cl_Cve_Cliente:         c.id,
        Cl_Razon_Social:        c.company        || '',
        Cl_Contacto_1:          c.name           || '',
        Cl_email_contacto_1:    c.email          || '',
        Cl_R_F_C:               c.rfc            ?? null,
        Cl_Telefono_1:          c.phone          ?? null,
        Cl_Ciudad:              c.city           ?? null,
        Cl_Estado:              c.state          ?? null,
        Sc_Cve_Sucursal:        c.sucursalId     ?? null,
        Sg_Cve_Segmento:        c.segmentoId     ?? null,
        Fecha_Alta:             c.createdAt,
        Fecha_Ult_Modif:        new Date().toISOString(),
      })),
      { onConflict: 'Cl_Cve_Cliente' }
    );
    if (error) { console.error(`✗ clients chunk ${i}–${i + chunk.length}:`, error.message); }
    else upserted += chunk.length;
  }
  console.log(`✓ clients upserted: ${upserted} / ${erpClients.length}`);

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
  const erpIdSet = new Set(erpClients.map((c) => c.id));
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
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n── ERP → Supabase sync  ${new Date().toLocaleString()} ──`);
  await syncSucursales();
  await syncSegmentos();
  await syncClients();
  console.log('── done ──\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});

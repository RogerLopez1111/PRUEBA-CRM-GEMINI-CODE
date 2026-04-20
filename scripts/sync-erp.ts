/**
 * sync-erp.ts
 * Pulls sucursales, segmentos, and ERP clients from SQL Server (ECO_2020)
 * and upserts them into Supabase so Vercel always has fresh data.
 *
 * Run manually:  npx tsx scripts/sync-erp.ts
 * Or scheduled:  add a Windows Task Scheduler job to run it periodically
 *
 * Rules:
 *  - sucursales / segmentos: full upsert (ERP is the single source of truth)
 *  - clientes: upsert ERP clients by Cl_Cve_Cliente.
 *    CRM prospects have random IDs that never match ERP business keys,
 *    so a plain upsert is safe — prospects are never overwritten.
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

// ---------------------------------------------------------------------------
// Sucursales
// ---------------------------------------------------------------------------
async function syncSucursales() {
  const rows = await getSucursales();
  if (!rows.length) { console.warn('⚠  No sucursales returned from SQL Server'); return; }

  const { error } = await supabase.from('sucursales').upsert(
    rows.map((s) => ({ Sc_Cve_Sucursal: s.id, Sc_Descripcion: s.name })),
    { onConflict: 'Sc_Cve_Sucursal' }
  );

  if (error) console.error('✗ sucursales:', error.message);
  else console.log(`✓ sucursales: ${rows.length} synced`);
}

// ---------------------------------------------------------------------------
// Segmentos
// ---------------------------------------------------------------------------
async function syncSegmentos() {
  const rows = await getSegmentos();
  if (!rows.length) { console.warn('⚠  No segmentos returned from SQL Server'); return; }

  const { error } = await supabase.from('segmentos').upsert(
    rows.map((s) => ({ Sg_Cve_Segmento: s.id, Sg_Descripcion: s.name })),
    { onConflict: 'Sg_Cve_Segmento' }
  );

  if (error) console.error('✗ segmentos:', error.message);
  else console.log(`✓ segmentos: ${rows.length} synced`);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
async function syncClients() {
  const erpClients = await getErpClients();
  if (!erpClients.length) { console.warn('⚠  No clients returned from SQL Server'); return; }

  // Batch upsert in chunks of 200 to avoid payload limits
  const CHUNK = 200;
  let synced = 0;
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
    else synced += chunk.length;
  }
  console.log(`✓ clients: ${synced} / ${erpClients.length} synced`);
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

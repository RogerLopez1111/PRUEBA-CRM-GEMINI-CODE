/**
 * digest-compras.ts
 *
 * Compiles every active Pedido Extraordinario and emails a digest to all
 * active Compras users, grouped by sucursal then by proveedor. Uses the
 * shared builder in src/digest-compras.ts so this stays in lockstep with
 * the API endpoint (cron + admin manual trigger).
 *
 *   npx tsx scripts/digest-compras.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { runDigest } from '../src/digest-compras.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function main() {
  console.log(`\n── Compras digest  ${new Date().toLocaleString()} ──`);
  const result = await runDigest(supabase);
  console.log(`✓ active pedidos: ${result.pedidoCount}`);
  console.log(`✓ recipients (compras users with email): ${result.recipientCount}`);
  for (const to of result.sentTo) console.log(`✓ sent to ${to}`);
  for (const f of result.failedTo) console.error(`✗ failed to send to ${f.email}: ${f.error}`);
  console.log('── done ──\n');
}

main().catch((err) => {
  console.error('Digest failed:', err);
  process.exit(1);
}).then(() => process.exit(0));

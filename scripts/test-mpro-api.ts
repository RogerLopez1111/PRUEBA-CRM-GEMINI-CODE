/**
 * Standalone smoke test for the ManagementPro (mproerp) WServices HTTP API.
 *
 * Usage (PowerShell):
 *   $env:MPRO_API_URL="https://your-host/wservices/"; $env:MPRO_API_KEY="your_apikey"; npx tsx scripts/test-mpro-api.ts
 *
 * Or add MPRO_API_URL and MPRO_API_KEY to .env and run:
 *   npx tsx scripts/test-mpro-api.ts
 */
import 'dotenv/config';

const API_URL = process.env.MPRO_API_URL;
const API_KEY = process.env.MPRO_API_KEY;

if (!API_URL || !API_KEY) {
  console.error('Missing env vars. Set MPRO_API_URL and MPRO_API_KEY (in .env or the shell).');
  process.exit(1);
}

async function callMpro(action: string, data: Record<string, unknown>) {
  const body = { apikey: API_KEY, provider: 'catalogos', action, data };
  const res = await fetch(API_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { httpStatus: res.status, json, raw: text };
}

async function main() {
  console.log(`\nPOST ${API_URL}  (action: GetClienteLista)\n`);

  const { httpStatus, json, raw } = await callMpro('GetClienteLista', {
    busqueda: '',
    estado: 'AC',
    clave: '',
    sucursal: '',
    grupo_comercial: '',
    vendedor: '',
    registros: '5',
  });

  console.log(`HTTP ${httpStatus}`);
  if (json) {
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log('Non-JSON response:\n', raw.slice(0, 2000));
  }
}

main().catch((err) => {
  console.error('Request failed:', err);
  process.exit(1);
});

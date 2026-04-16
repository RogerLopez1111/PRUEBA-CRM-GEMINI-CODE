import sql from 'mssql';

const config: sql.config = {
  server: process.env.MSSQL_SERVER!,
  database: process.env.MSSQL_DATABASE!,
  user: process.env.MSSQL_USER!,
  password: process.env.MSSQL_PASSWORD!,
  options: {
    trustServerCertificate: true, // required for local / self-signed certs
    encrypt: false,               // local SQL Server doesn't need encryption
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool || !pool.connected) {
    pool = await new sql.ConnectionPool(config).connect();
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Shared mapper
// ---------------------------------------------------------------------------

function mapErpClient(c: Record<string, any>) {
  return {
    id: String(c.Cl_Cve_Cliente ?? ''),
    name: String(c.Cl_Contacto_1 ?? ''),
    email: String(c.Cl_email_contacto_1 ?? ''),
    company: String(c.Cl_Razon_Social ?? ''),
    rfc: c.Cl_R_F_C ? String(c.Cl_R_F_C) : undefined,
    phone: c.Cl_Telefono_1 ? String(c.Cl_Telefono_1) : undefined,
    city: c.Cl_Ciudad ? String(c.Cl_Ciudad) : undefined,
    state: c.Cl_Estado ? String(c.Cl_Estado) : undefined,
    sucursalId: c.Sc_Cve_Sucursal ? String(c.Sc_Cve_Sucursal) : undefined,
    segmentoId: c.Sg_Cve_Segmento ? String(c.Sg_Cve_Segmento) : undefined,
    createdAt: c.Fecha_Alta instanceof Date ? c.Fecha_Alta.toISOString() : new Date().toISOString(),
    source: 'erp' as const,
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function getSucursales(): Promise<{ id: string; name: string }[]> {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT Sc_Cve_Sucursal, Sc_Descripcion
      FROM Sucursal
      WHERE Es_Cve_Estado = 'AC'
      ORDER BY Sc_Descripcion
    `);
    return r.recordset.map((s) => ({ id: String(s.Sc_Cve_Sucursal), name: s.Sc_Descripcion }));
  } catch (err) {
    console.error('[MSSQL] getSucursales:', err);
    return [];
  }
}

export async function getSegmentos(): Promise<{ id: string; name: string }[]> {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT Sg_Cve_Segmento, Sg_Descripcion
      FROM Segmento
      WHERE Es_Cve_Estado = 'AC'
      ORDER BY Sg_Descripcion
    `);
    return r.recordset.map((s) => ({ id: s.Sg_Cve_Segmento, name: s.Sg_Descripcion }));
  } catch (err) {
    console.error('[MSSQL] getSegmentos:', err);
    return [];
  }
}

export async function getSucursalesMap(): Promise<Record<string, string>> {
  const list = await getSucursales();
  return Object.fromEntries(list.map((s) => [s.id, s.name]));
}

export async function getSegmentosMap(): Promise<Record<string, string>> {
  const list = await getSegmentos();
  return Object.fromEntries(list.map((s) => [s.id, s.name]));
}

// ---------------------------------------------------------------------------
// Clients (read-only from ERP)
// ---------------------------------------------------------------------------

export async function getErpClients(): Promise<ReturnType<typeof mapErpClient>[]> {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT
        Cl_Cve_Cliente, Cl_Razon_Social, Cl_Contacto_1, Cl_email_contacto_1,
        Cl_R_F_C, Cl_Telefono_1, Cl_Ciudad, Cl_Estado,
        Sc_Cve_Sucursal, Sg_Cve_Segmento, Fecha_Alta
      FROM Cliente
      WHERE Es_Cve_Estado = 'AC'
      ORDER BY Cl_Razon_Social
    `);
    return r.recordset.map(mapErpClient);
  } catch (err) {
    console.error('[MSSQL] getErpClients:', err);
    return [];
  }
}

// Find ERP client by Razon Social — bridge used when a sale is closed (FACTURADO)
// to migrate the CRM prospect to the real ERP client record
export async function findErpClientByRazonSocial(razonSocial: string): Promise<ReturnType<typeof mapErpClient>[]> {
  try {
    const p = await getPool();
    const req = p.request();
    req.input('razon', sql.NVarChar, razonSocial.trim());
    const r = await req.query(`
      SELECT TOP 10
        Cl_Cve_Cliente, Cl_Razon_Social, Cl_Contacto_1, Cl_email_contacto_1,
        Cl_R_F_C, Cl_Telefono_1, Cl_Ciudad, Cl_Estado,
        Sc_Cve_Sucursal, Sg_Cve_Segmento, Fecha_Alta
      FROM Cliente
      WHERE LOWER(LTRIM(RTRIM(Cl_Razon_Social))) = LOWER(LTRIM(RTRIM(@razon)))
        AND Es_Cve_Estado = 'AC'
    `);
    return r.recordset.map(mapErpClient);
  } catch (err) {
    console.error('[MSSQL] findErpClientByRazonSocial:', err);
    return [];
  }
}

export async function getErpClientById(id: string): Promise<ReturnType<typeof mapErpClient> | null> {
  try {
    const p = await getPool();
    const req = p.request();
    req.input('id', sql.NVarChar, id);
    const r = await req.query(`
      SELECT TOP 1
        Cl_Cve_Cliente, Cl_Razon_Social, Cl_Contacto_1, Cl_email_contacto_1,
        Cl_R_F_C, Cl_Telefono_1, Cl_Ciudad, Cl_Estado,
        Sc_Cve_Sucursal, Sg_Cve_Segmento, Fecha_Alta
      FROM Cliente
      WHERE Cl_Cve_Cliente = @id
    `);
    return r.recordset[0] ? mapErpClient(r.recordset[0]) : null;
  } catch (err) {
    console.error('[MSSQL] getErpClientById:', err);
    return null;
  }
}

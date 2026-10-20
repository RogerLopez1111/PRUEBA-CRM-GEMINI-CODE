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
    company: String(c.Cl_Razon_Social ?? '').trim(),
    tradeName: c.Cl_Descripcion ? String(c.Cl_Descripcion).trim() : undefined,
    rfc: c.Cl_R_F_C ? String(c.Cl_R_F_C) : undefined,
    phone: c.Cl_Telefono_1 ? String(c.Cl_Telefono_1) : undefined,
    city: c.Cl_Ciudad ? String(c.Cl_Ciudad) : undefined,
    state: c.Cl_Estado ? String(c.Cl_Estado) : undefined,
    sucursalId: c.Sc_Cve_Sucursal ? String(c.Sc_Cve_Sucursal) : undefined,
    segmentoId: c.Sg_Cve_Segmento ? String(c.Sg_Cve_Segmento) : undefined,
    estado: c.Es_Cve_Estado ? String(c.Es_Cve_Estado).trim() : undefined,
    createdAt: c.Fecha_Alta instanceof Date ? c.Fecha_Alta.toISOString() : new Date().toISOString(),
    source: 'erp' as const,
  };
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export async function getSucursales(): Promise<{ id: string; name: string; estado: string }[]> {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT Sc_Cve_Sucursal, Sc_Descripcion, Es_Cve_Estado
      FROM Sucursal
      ORDER BY Sc_Descripcion
    `);
    return r.recordset.map((s) => ({
      id: String(s.Sc_Cve_Sucursal),
      name: s.Sc_Descripcion,
      estado: String(s.Es_Cve_Estado ?? 'AC'),
    }));
  } catch (err) {
    console.error('[MSSQL] getSucursales:', err);
    return [];
  }
}

export async function getSegmentos(): Promise<{ id: string; name: string; estado: string }[]> {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT Sg_Cve_Segmento, Sg_Descripcion, Es_Cve_Estado
      FROM Segmento
      ORDER BY Sg_Descripcion
    `);
    return r.recordset.map((s) => ({
      id: s.Sg_Cve_Segmento,
      name: s.Sg_Descripcion,
      estado: String(s.Es_Cve_Estado ?? 'AC'),
    }));
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
// Vendedores (read-only from ERP)
// ---------------------------------------------------------------------------

export async function getVendedores(): Promise<
  { id: string; name: string; email: string | null; sucursalId: string | null; estado: string }[]
> {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT Vn_Cve_Vendedor, Vn_Descripcion, Vn_Email, Vn_Sucursal, Es_Cve_Estado
      FROM Vendedor
      WHERE Es_Cve_Estado = 'AC'
      ORDER BY Vn_Descripcion
    `);
    return r.recordset.map((v) => ({
      id: String(v.Vn_Cve_Vendedor),
      name: String(v.Vn_Descripcion ?? ''),
      email: v.Vn_Email ? String(v.Vn_Email) : null,
      sucursalId: v.Vn_Sucursal != null ? String(v.Vn_Sucursal) : null,
      estado: String(v.Es_Cve_Estado ?? 'AC'),
    }));
  } catch (err) {
    console.error('[MSSQL] getVendedores:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Ventas analíticas por cliente/mes — feeds the materialized
// "REPORTE ANALÍTICO DE VENTAS ANUAL (CLIENTE)" table (erp_ventas_cliente_mensual).
// One row per (vendedor que vendió, cliente, mes). Validated to the peso against
// the ManagementPro report: importe = SUM(Vn_Precio_Descontado_Importe) sin IVA,
// estatus FA, vendedor = sale's vendedor, segmento = client's current segmento.
// ---------------------------------------------------------------------------
export type VentaClienteMensual = {
  vendedorId: string;
  vendedorNombre: string;
  segmentoId: string;
  segmentoNombre: string;
  clienteId: string;
  clienteNombre: string;
  razonSocial: string;
  periodo: string; // 'YYYY-MM'
  importe: number;
};

export async function getVentasClienteMensual(
  desde: string, // 'YYYY-MM-DD' inclusive
  hasta: string  // 'YYYY-MM-DD' exclusive
): Promise<VentaClienteMensual[]> {
  try {
    const p = await getPool();
    const req = p.request();
    req.input('desde', sql.DateTime, new Date(desde));
    req.input('hasta', sql.DateTime, new Date(hasta));
    const r = await req.query(`
      SELECT
        ve.Vn_Cve_Vendedor                        AS vendedorId,
        MAX(LTRIM(RTRIM(v.Vn_Descripcion)))       AS vendedorNombre,
        c.Sg_Cve_Segmento                         AS segmentoId,
        MAX(LTRIM(RTRIM(s.Sg_Descripcion)))       AS segmentoNombre,
        ve.Cl_Cve_Cliente                         AS clienteId,
        MAX(LTRIM(RTRIM(c.Cl_Descripcion)))       AS clienteNombre,
        MAX(LTRIM(RTRIM(c.Cl_Razon_Social)))      AS razonSocial,
        CONVERT(char(7), ve.Vn_Fecha, 126)        AS periodo,
        SUM(ve.Vn_Precio_Descontado_Importe)      AS importe
      FROM Venta ve
      JOIN Cliente c      ON c.Cl_Cve_Cliente   = ve.Cl_Cve_Cliente
      LEFT JOIN Segmento s ON s.Sg_Cve_Segmento = c.Sg_Cve_Segmento
      LEFT JOIN Vendedor v ON v.Vn_Cve_Vendedor = ve.Vn_Cve_Vendedor
      WHERE ve.Es_Cve_Estado = 'FA'
        AND ve.Vn_Fecha >= @desde AND ve.Vn_Fecha < @hasta
      GROUP BY ve.Vn_Cve_Vendedor, c.Sg_Cve_Segmento, ve.Cl_Cve_Cliente,
               CONVERT(char(7), ve.Vn_Fecha, 126)
    `);
    return r.recordset.map((row) => ({
      vendedorId: String(row.vendedorId ?? ''),
      vendedorNombre: String(row.vendedorNombre ?? ''),
      segmentoId: String(row.segmentoId ?? ''),
      segmentoNombre: String(row.segmentoNombre ?? ''),
      clienteId: String(row.clienteId ?? ''),
      clienteNombre: String(row.clienteNombre ?? ''),
      razonSocial: String(row.razonSocial ?? ''),
      periodo: String(row.periodo ?? ''),
      importe: Number(row.importe) || 0,
    }));
  } catch (err) {
    console.error('[MSSQL] getVentasClienteMensual:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Rentabilidad por vendedor/mes — feeds the materialized
// "REPORTE DE RENTABILIDAD" (por Vendedor) table (erp_rentabilidad_vendedor_mensual).
//
// Faithful port of the ManagementPro report RPVNA06 (RPVNA06_CO.asp) for the
// Agrupar = "36" (Vendedor) case, which the ERP builds from THREE sources, all
// filtered Es_Cve_Estado <> 'CA' within [desde, hasta):
//   • Venta           → ventaImporte = SUM((Vn_Precio_Descontado_Importe
//                       - Vn_Descuento_Global_Importe) * Vn_Tipo_Cambio)
//                       ventaCosto   = SUM(Vn_Costo_Importe)
//   • Nota_Credito (Nc_Tabla IN ('ACUSE_RECIBO','DEVOLUCION_CLIENTE')) → dev/rechazo
//                       devImporte, devCosto (same expressions, Nc_ prefix)
//   • Nota_Credito (Nc_Tabla NOT IN (...))                             → bonificaciones
//                       boniImporte (importe only; no cost)
// The net profitability is derived at read time (rentabilidad-core):
//   ImporteNeto = ventaImporte - devImporte - boniImporte
//   CostoNeto   = ventaCosto   - devCosto
//   Utilidad    = ImporteNeto  - CostoNeto ;  % = Utilidad / ImporteNeto
// Merma & Gasto are intentionally excluded — the ERP disables both for the
// Vendedor grouping. Vendedor on the Nota_Credito side is the NC's own vendedor.
// The INNER JOINs (Sucursal/Almacen/Cliente/Ruta/Producto) mirror the ERP's
// grain exactly so orphan rows drop the same way and totals match to the peso.
// One row per (vendedor, mes); amounts are in base currency (pesos) via tipo de
// cambio, so USD sales are converted just like the ERP report.
// ---------------------------------------------------------------------------
export type RentabilidadVendedorMensual = {
  vendedorId: string;
  vendedorNombre: string;
  periodo: string; // 'YYYY-MM'
  ventaImporte: number;
  ventaCosto: number;
  devImporte: number;
  devCosto: number;
  boniImporte: number;
};

export async function getRentabilidadVendedorMensual(
  desde: string, // 'YYYY-MM-DD' inclusive
  hasta: string  // 'YYYY-MM-DD' exclusive
): Promise<RentabilidadVendedorMensual[]> {
  try {
    const p = await getPool();
    const req = p.request();
    req.input('desde', sql.DateTime, new Date(desde));
    req.input('hasta', sql.DateTime, new Date(hasta));
    const r = await req.query(`
      WITH V AS (
        SELECT
          ve.Vn_Cve_Vendedor                 AS vendedorId,
          CONVERT(char(7), ve.Vn_Fecha, 126) AS periodo,
          SUM(ve.Vn_Costo_Importe)           AS ventaCosto,
          SUM((ve.Vn_Precio_Descontado_Importe - ve.Vn_Descuento_Global_Importe) * ve.Vn_Tipo_Cambio) AS ventaImporte
        FROM Venta ve
          INNER JOIN Sucursal su ON su.Sc_Cve_Sucursal = ve.Sc_Cve_Sucursal
          INNER JOIN Almacen  al ON al.Al_Cve_Almacen  = ve.Al_Cve_Almacen AND al.Sc_Cve_Sucursal = su.Sc_Cve_Sucursal
          INNER JOIN Cliente  cl ON cl.Cl_Cve_Cliente  = ve.Cl_Cve_Cliente
          INNER JOIN Ruta     ru ON ru.Rt_Cve_Ruta     = cl.Rt_Cve_Ruta
          INNER JOIN Producto pr ON pr.Pr_Cve_Producto = ve.Pr_Cve_Producto
          INNER JOIN Vendedor vn ON vn.Vn_Cve_Vendedor = ve.Vn_Cve_Vendedor
        WHERE ve.Vn_Fecha >= @desde AND ve.Vn_Fecha < @hasta
          AND ve.Es_Cve_Estado <> 'CA'
        GROUP BY ve.Vn_Cve_Vendedor, CONVERT(char(7), ve.Vn_Fecha, 126)
      ),
      D AS (
        SELECT
          nc.Vn_Cve_Vendedor                 AS vendedorId,
          CONVERT(char(7), nc.Nc_Fecha, 126) AS periodo,
          SUM(nc.Nc_Costo_Importe)           AS devCosto,
          SUM((nc.Nc_Precio_Descontado_Importe - nc.Nc_Descuento_Global_Importe) * nc.Nc_Tipo_Cambio) AS devImporte
        FROM Nota_Credito nc
          INNER JOIN Sucursal su ON su.Sc_Cve_Sucursal = nc.Sc_Cve_Sucursal
          INNER JOIN Almacen  al ON al.Al_Cve_Almacen  = nc.Al_Cve_Almacen AND al.Sc_Cve_Sucursal = su.Sc_Cve_Sucursal
          INNER JOIN Cliente  cl ON cl.Cl_Cve_Cliente  = nc.Cl_Cve_Cliente
          INNER JOIN Ruta     ru ON ru.Rt_Cve_Ruta     = cl.Rt_Cve_Ruta
          INNER JOIN Producto pr ON pr.Pr_Cve_Producto = nc.Pr_Cve_Producto
          INNER JOIN Vendedor vn ON vn.Vn_Cve_Vendedor = nc.Vn_Cve_Vendedor
        WHERE nc.Nc_Fecha >= @desde AND nc.Nc_Fecha < @hasta
          AND nc.Es_Cve_Estado <> 'CA'
          AND nc.Nc_Tabla IN ('ACUSE_RECIBO','DEVOLUCION_CLIENTE')
        GROUP BY nc.Vn_Cve_Vendedor, CONVERT(char(7), nc.Nc_Fecha, 126)
      ),
      B AS (
        SELECT
          nc.Vn_Cve_Vendedor                 AS vendedorId,
          CONVERT(char(7), nc.Nc_Fecha, 126) AS periodo,
          SUM((nc.Nc_Precio_Descontado_Importe - nc.Nc_Descuento_Global_Importe) * nc.Nc_Tipo_Cambio) AS boniImporte
        FROM Nota_Credito nc
          INNER JOIN Sucursal su ON su.Sc_Cve_Sucursal = nc.Sc_Cve_Sucursal
          INNER JOIN Almacen  al ON al.Al_Cve_Almacen  = nc.Al_Cve_Almacen AND al.Sc_Cve_Sucursal = su.Sc_Cve_Sucursal
          INNER JOIN Cliente  cl ON cl.Cl_Cve_Cliente  = nc.Cl_Cve_Cliente
          INNER JOIN Ruta     ru ON ru.Rt_Cve_Ruta     = cl.Rt_Cve_Ruta
          INNER JOIN Producto pr ON pr.Pr_Cve_Producto = nc.Pr_Cve_Producto
          INNER JOIN Vendedor vn ON vn.Vn_Cve_Vendedor = nc.Vn_Cve_Vendedor
        WHERE nc.Nc_Fecha >= @desde AND nc.Nc_Fecha < @hasta
          AND nc.Es_Cve_Estado <> 'CA'
          AND nc.Nc_Tabla NOT IN ('ACUSE_RECIBO','DEVOLUCION_CLIENTE')
        GROUP BY nc.Vn_Cve_Vendedor, CONVERT(char(7), nc.Nc_Fecha, 126)
      ),
      K AS (
        SELECT vendedorId, periodo FROM V
        UNION SELECT vendedorId, periodo FROM D
        UNION SELECT vendedorId, periodo FROM B
      )
      SELECT
        K.vendedorId                          AS vendedorId,
        LTRIM(RTRIM(vn.Vn_Descripcion))       AS vendedorNombre,
        K.periodo                             AS periodo,
        ISNULL(V.ventaImporte, 0)             AS ventaImporte,
        ISNULL(V.ventaCosto, 0)               AS ventaCosto,
        ISNULL(D.devImporte, 0)               AS devImporte,
        ISNULL(D.devCosto, 0)                 AS devCosto,
        ISNULL(B.boniImporte, 0)              AS boniImporte
      FROM K
        LEFT JOIN V ON V.vendedorId = K.vendedorId AND V.periodo = K.periodo
        LEFT JOIN D ON D.vendedorId = K.vendedorId AND D.periodo = K.periodo
        LEFT JOIN B ON B.vendedorId = K.vendedorId AND B.periodo = K.periodo
        LEFT JOIN Vendedor vn ON vn.Vn_Cve_Vendedor = K.vendedorId
      ORDER BY K.vendedorId, K.periodo
    `);
    return r.recordset.map((row) => ({
      vendedorId: String(row.vendedorId ?? ''),
      vendedorNombre: String(row.vendedorNombre ?? ''),
      periodo: String(row.periodo ?? ''),
      ventaImporte: Number(row.ventaImporte) || 0,
      ventaCosto: Number(row.ventaCosto) || 0,
      devImporte: Number(row.devImporte) || 0,
      devCosto: Number(row.devCosto) || 0,
      boniImporte: Number(row.boniImporte) || 0,
    }));
  } catch (err) {
    console.error('[MSSQL] getRentabilidadVendedorMensual:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Clients (read-only from ERP)
// ---------------------------------------------------------------------------

export async function getErpClients(): Promise<ReturnType<typeof mapErpClient>[]> {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT
        Cl_Cve_Cliente, Cl_Razon_Social, Cl_Descripcion, Cl_Contacto_1, Cl_email_contacto_1,
        Cl_R_F_C, Cl_Telefono_1, Cl_Ciudad, Cl_Estado,
        Sc_Cve_Sucursal, Sg_Cve_Segmento, Es_Cve_Estado, Fecha_Alta
      FROM Cliente
      ORDER BY Cl_Razon_Social
    `);
    return r.recordset.map(mapErpClient);
  } catch (err) {
    console.error('[MSSQL] getErpClients:', err);
    return [];
  }
}

// Raw SELECT * used by the sync script to mirror every ERP column into Supabase.
// Date columns come back as JS Date objects; callers must normalize before writing.
export async function getErpClientsRaw(): Promise<Record<string, any>[]> {
  try {
    const p = await getPool();
    const r = await p.request().query(`SELECT * FROM Cliente ORDER BY Cl_Razon_Social`);
    return r.recordset;
  } catch (err) {
    console.error('[MSSQL] getErpClientsRaw:', err);
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
        Cl_Cve_Cliente, Cl_Razon_Social, Cl_Descripcion, Cl_Contacto_1, Cl_email_contacto_1,
        Cl_R_F_C, Cl_Telefono_1, Cl_Ciudad, Cl_Estado,
        Sc_Cve_Sucursal, Sg_Cve_Segmento, Es_Cve_Estado, Fecha_Alta
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

// ---------------------------------------------------------------------------
// Productos (read-only from ERP)
// Tier-1 column subset: identity / search / status / unit / audit dates.
// Mirrored to Supabase `productos` for the lost-sales picker.
// ---------------------------------------------------------------------------

export async function getProductosRaw(): Promise<Record<string, any>[]> {
  try {
    const p = await getPool();
    const r = await p.request().query(`
      SELECT
        Pr_Cve_Producto, Pr_Clave_Corta, Pr_Numero_Parte, Pr_Barras,
        Pr_Descripcion, Pr_Descripcion_Corta, Pr_Unidad_Venta,
        Pv_Cve_Proveedor,
        Es_Cve_Estado, Fecha_Alta, Fecha_Ult_Modif, Fecha_Baja
      FROM Producto
      ORDER BY Pr_Descripcion
    `);
    return r.recordset;
  } catch (err) {
    console.error('[MSSQL] getProductosRaw:', err);
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
        Cl_Cve_Cliente, Cl_Razon_Social, Cl_Descripcion, Cl_Contacto_1, Cl_email_contacto_1,
        Cl_R_F_C, Cl_Telefono_1, Cl_Ciudad, Cl_Estado,
        Sc_Cve_Sucursal, Sg_Cve_Segmento, Es_Cve_Estado, Fecha_Alta
      FROM Cliente
      WHERE Cl_Cve_Cliente = @id
    `);
    return r.recordset[0] ? mapErpClient(r.recordset[0]) : null;
  } catch (err) {
    console.error('[MSSQL] getErpClientById:', err);
    return null;
  }
}

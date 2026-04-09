import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.VERCEL
  ? '/tmp/database.sqlite'
  : path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initDb() {
  // Create lookup tables with minimal structure to satisfy foreign keys
  const lookupTables = [
    'Cadena_Comercial', 'Promotor', 'Comisionista_Externo', 'Distribuidor', 
    'Estado', 'Giro_Comercial', 'Grupo_Comercial', 'Ruta', 'Sector', 
    'Segmento', 'Tipo_Cliente', 'Empresa', 'Zona', 'Grupo_Sucursal', 'Grupo_Vendedor'
  ];

  lookupTables.forEach(table => {
    const pk = table === 'Cadena_Comercial' ? 'Cc_Cve_Cadena_Comercial' :
               table === 'Promotor' ? 'Pr_Cve_Promotor' :
               table === 'Comisionista_Externo' ? 'Ce_Cve_Comisionista_Externo' :
               table === 'Distribuidor' ? 'Ds_Cve_Distribuidor' :
               table === 'Estado' ? 'Es_Cve_Estado' :
               table === 'Giro_Comercial' ? 'Gm_Cve_Giro_Comercial' :
               table === 'Grupo_Comercial' ? 'Gc_Cve_Grupo_Comercial' :
               table === 'Ruta' ? 'Rt_Cve_Ruta' :
               table === 'Sector' ? 'Sc_Cve_Sector' :
               table === 'Segmento' ? 'Sg_Cve_Segmento' :
               table === 'Tipo_Cliente' ? 'Tc_Cve_Tipo_Cliente' :
               table === 'Empresa' ? 'Em_Cve_Empresa' :
               table === 'Zona' ? 'Zn_Cve_Zona' :
               table === 'Grupo_Sucursal' ? 'Gs_Cve_Grupo_Sucursal' :
               table === 'Grupo_Vendedor' ? 'Gv_Cve_Grupo_Vendedor' : 'id';
    
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (${pk} TEXT PRIMARY KEY, Descripcion TEXT)`);
  });

  // Create Sucursal table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Sucursal (
      Sc_Cve_Sucursal TEXT PRIMARY KEY,
      Zn_Cve_Zona TEXT,
      Em_Cve_Empresa TEXT,
      Gs_Cve_Grupo_Sucursal TEXT,
      Sc_Centro_Costo TEXT,
      Sc_Centro_Distribucion TEXT,
      Sc_Cuenta_Contable TEXT,
      Sc_Grupo_Impuesto TEXT,
      Sc_Condicion_Venta TEXT,
      Sc_Descripcion TEXT NOT NULL,
      Sc_Direccion_1 TEXT, Sc_Direccion_2 TEXT, Sc_Direccion_3 TEXT,
      Sc_Ciudad TEXT, Sc_Municipio TEXT, Sc_Estado TEXT, Sc_Pais TEXT,
      Sc_Telefono_1 TEXT, Sc_Telefono_2 TEXT, Sc_Telefono_3 TEXT,
      Sc_Gerente TEXT, Sc_Comentario TEXT, Sc_Prefijo_General TEXT,
      Sc_Factura_Serie TEXT, Sc_Nota_Credito_Serie TEXT, Sc_Comprobante_Pago_Serie TEXT, Sc_Factura_Serie_Web TEXT,
      Sc_Formato_Factura TEXT, Sc_Formato_Nota_Credito TEXT, Sc_Formato_Comprobante_Pago TEXT, Sc_Formato_Factura_Web TEXT,
      Sc_Sucursal_Remota TEXT, Sc_Url_Servidor_Remoto TEXT, Sc_Servidor_Id TEXT, Sc_Servidor TEXT,
      Sc_Usuario TEXT, Sc_Password TEXT, Sc_Empresa TEXT, Sc_Calle TEXT,
      Sc_Numero_Exterior TEXT, Sc_Numero_Interior TEXT, Sc_Colonia TEXT, Sc_Referencia TEXT,
      Sc_Municipio_Fiscal TEXT, Sc_Codigo_Postal TEXT, Sc_Razon_Social TEXT,
      Sc_Ciudad_Fiscal TEXT, Sc_Estado_Fiscal TEXT, Sc_Pais_Fiscal TEXT, Sc_R_F_C TEXT,
      Sc_Plantilla_Mail_CFD TEXT, Sc_Plantilla_Mail_CFD_Cancelado TEXT, Sc_Bcc_Mail_CFD TEXT,
      Sc_Call_Center_Webservice TEXT, Sc_Plantilla_XML TEXT, Sc_Plantilla_XML2 TEXT,
      Sc_Latitud TEXT, Sc_Longitud TEXT, Sc_Recibo_Nomina_Serie TEXT, Sc_Formato_Recibo_Nomina TEXT,
      Sc_Retencion_Serie TEXT, Sc_Formato_Retencion TEXT, Sc_Analizar TEXT,
      Sc_Cve_Ciudad TEXT, Sc_Cve_Municipio TEXT, Sc_Cve_Estado TEXT, Sc_Cve_Pais TEXT,
      Sc_Cve_Colonia_Expedicion TEXT, Sc_Cve_Codigo_Postal_Expedicion TEXT, Sc_Cve_Colonia TEXT,
      Sc_Cve_Ciudad_Fiscal TEXT, Sc_Cve_Municipio_Fiscal TEXT, Sc_Cve_Estado_Fiscal TEXT, Sc_Cve_Pais_Fiscal TEXT, Sc_Cve_Codigo_Postal TEXT,
      Sc_Traslado_Serie TEXT, Sc_Formato_Traslado TEXT,
      Sc_UserDef_1 TEXT, Sc_UserDef_2 TEXT, Sc_UserDef_3 REAL, Sc_UserDef_4 REAL, Sc_UserDef_5 TEXT, Sc_UserDef_6 TEXT,
      Oper_Alta TEXT, Fecha_Alta TEXT, Oper_Ult_Modif TEXT, Fecha_Ult_Modif TEXT, Oper_Baja TEXT, Fecha_Baja TEXT,
      Es_Cve_Estado TEXT, SC_Formato_Venta TEXT, Sc_Extendeal_Store_Id TEXT
    )
  `);

  // Create Vendedor table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Vendedor (
      Vn_Cve_Vendedor TEXT PRIMARY KEY,
      Vn_Descripcion TEXT NOT NULL,
      Gv_Cve_Grupo_Vendedor TEXT,
      Vn_Sucursal TEXT, Vn_Almacen TEXT, Vn_Nivel REAL, Vn_Operador TEXT,
      Vn_Genera_Comision TEXT, Vn_Centro_Costo TEXT, Vn_Cuenta_Contable TEXT,
      Vn_Deudor TEXT, Vn_Password TEXT, Vn_Empleado TEXT, Vn_Prefijo TEXT, Vn_Perfil TEXT,
      Vn_Habilitar_Mesero TEXT, Vn_Color REAL, Vn_Iniciales TEXT,
      Vn_UserDef_1 TEXT, Vn_UserDef_2 TEXT, Vn_UserDef_3 REAL, Vn_UserDef_4 REAL, Vn_UserDef_5 TEXT, Vn_UserDef_6 TEXT,
      Vn_Contacto TEXT, Vn_Direccion_1 TEXT, Vn_Direccion_2 TEXT, Vn_Direccion_3 TEXT,
      Vn_Codigo_Postal TEXT, Vn_Colonia TEXT, Vn_Ciudad TEXT, Vn_Estado TEXT, Vn_Pais TEXT,
      Vn_Email_Contacto TEXT, Vn_Telefono_1 TEXT, Vn_Telefono_2 TEXT, Vn_Telefono_3 TEXT,
      Vn_Email TEXT, Vn_Promotor TEXT, Vn_Comisionista TEXT, Vn_Sexo TEXT, Vn_Nivel_Estudio TEXT,
      Vn_Automovil TEXT, Vn_Estado_Civil TEXT, Vn_Fecha_Nacimiento TEXT, Vn_Persona TEXT,
      Oper_Alta TEXT, Fecha_Alta TEXT, Oper_Ult_Modif TEXT, Fecha_Ult_Modif TEXT, Oper_Baja TEXT, Fecha_Baja TEXT,
      Es_Cve_Estado TEXT,
      Vn_Rol_CRM TEXT CHECK(Vn_Rol_CRM IN ('Admin', 'Seller')) NOT NULL DEFAULT 'Seller',
      Vn_Meta_Ventas_CRM REAL DEFAULT 0
    )
  `);

  // Create Cliente table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Cliente (
      Cl_Cve_Cliente TEXT PRIMARY KEY,
      Sc_Cve_Sucursal TEXT, Sg_Cve_Segmento TEXT, Rt_Cve_Ruta TEXT,
      Gc_Cve_Grupo_Comercial TEXT, Cc_Cve_Cadena_Comercial TEXT, Gm_Cve_Giro_Comercial TEXT,
      Cl_Cve_Maestro TEXT, Cl_Razon_Social TEXT NOT NULL, Cl_Razon_Social_1 TEXT, Cl_Razon_Social_2 TEXT,
      Cl_Descripcion TEXT, Cl_R_F_C TEXT, Cl_Cedula_Fiscal TEXT, Cl_CURP TEXT,
      Cl_Direccion_1 TEXT, Cl_Direccion_2 TEXT, Cl_Direccion_3 TEXT,
      Cl_Telefono_1 TEXT, Cl_Telefono_2 TEXT, Cl_Telefono_3 TEXT,
      Cl_Ciudad TEXT, Cl_Municipio TEXT, Cl_Estado TEXT, Cl_Pais TEXT,
      Cl_Sitio_Web TEXT, Cl_Contacto_1 TEXT, Cl_email_contacto_1 TEXT,
      Cl_Contacto_2 TEXT, Cl_email_contacto_2 TEXT,
      Tc_Cve_Tipo_Cliente TEXT, Cl_Tipo_Cuenta TEXT, Cl_Clasificacion_ABC TEXT,
      Cl_Jerarquia_Credito TEXT, Cl_Limite_Credito REAL, Cl_Dias_Credito REAL, Cl_Dias_Bloqueo REAL,
      Cl_Saldo REAL, Cl_Bloqueado TEXT,
      Cl_Revision_Domingo TEXT, Cl_Revision_Lunes TEXT, Cl_Revision_Martes TEXT, Cl_Revision_Miercoles TEXT, Cl_Revision_Jueves TEXT, Cl_Revision_Viernes TEXT, Cl_Revision_Sabado TEXT,
      Cl_Pago_Domingo TEXT, Cl_Pago_Lunes TEXT, Cl_Pago_Martes TEXT, Cl_Pago_Miercoles TEXT, Cl_Pago_Jueves TEXT, Cl_Pago_Viernes TEXT, Cl_Pago_Sabado TEXT,
      Cl_Facturar TEXT,
      Cl_Direccion_Entrega_1 TEXT, Cl_Direccion_Entrega_2 TEXT, Cl_Direccion_Entrega_3 TEXT,
      Cl_Ciudad_Entrega TEXT, Cl_Estado_Entrega TEXT, Cl_Pais_Entrega TEXT,
      Cl_Centro_Costo TEXT, Cl_Cuenta_Contable TEXT,
      Vn_Cve_Vendedor TEXT, Pr_Cve_Promotor TEXT, Ce_Cve_Comisionista_Externo TEXT,
      Sc_Cve_Sector TEXT, Cl_Grupo_Impuesto TEXT, Cl_Addenda TEXT, Cl_Condicion_Venta TEXT,
      Cl_Formato_Factura TEXT, Cl_Formato_Nota_Credito TEXT, Cl_Esquema_Precio REAL, Cl_Descuentos TEXT,
      Cl_Aplicar_Descuento_Global TEXT, Cl_Database TEXT, Cl_Proveedor TEXT, Cl_Almacen TEXT, Cl_Comprador TEXT, Cl_Sucursal TEXT,
      Cl_Generar_Entrada_Compra TEXT, Cl_Registrar_Compra_Remision TEXT, Cl_Registrar_Compra_Factura TEXT, Cl_Generar_Cxp TEXT,
      Cl_Organizacion TEXT, Cl_Tipo_Persona TEXT, Cl_Persona TEXT, Cl_Apellido_Paterno TEXT, Cl_Apellido_Materno TEXT, Cl_Nombres TEXT,
      Cl_Fecha_Nacimiento TEXT, Cl_Nacionalidad TEXT, Cl_Descuento_Factor REAL, Cl_Calle TEXT,
      Cl_Numero_Exterior TEXT, Cl_Numero_Interior TEXT, Cl_Cruzamiento_1 TEXT, Cl_Cruzamiento_2 TEXT, Cl_Colonia TEXT,
      Cl_Codigo_Postal TEXT, Cl_Codigo_Postal_Entrega TEXT, Cl_Addenda_Nota_Credito TEXT,
      Cl_Facebook TEXT, Cl_Twitter TEXT, Cl_Sexo TEXT, Cl_Codigo_Barras TEXT,
      Cl_Tarjeta_Credito TEXT, Cl_Tarjeta_Nombre_Completo TEXT, Cl_Tarjeta_Banco TEXT, Cl_Tarjeta_Numero TEXT, Cl_Tarjeta_Vencimiento TEXT, Cl_Tarjeta_Codigo_Seguridad TEXT,
      Cl_Latitud TEXT, Cl_Longitud TEXT, Ds_Cve_Distribuidor TEXT,
      Cl_Cuenta_Contable_2 TEXT, Cl_Cuenta_Contable_3 TEXT, Cl_Complemento_Fiscal TEXT, Cl_Motivo_Traslado_Ce TEXT, Cl_Codigo_Incoterm TEXT, Cl_Tax_Id TEXT,
      Cl_Cve_Colonia TEXT, Cl_Cve_Ciudad TEXT, Cl_Cve_Municipio TEXT, Cl_Cve_Estado TEXT, Cl_Cve_Pais TEXT, Cl_Cve_Codigo_Postal TEXT,
      Cl_UserDef_1 TEXT, Cl_UserDef_2 TEXT, Cl_UserDef_3 REAL, Cl_UserDef_4 REAL, Cl_UserDef_5 TEXT, Cl_UserDef_6 TEXT,
      Oper_Alta TEXT, Fecha_Alta TEXT, Oper_Ult_Modif TEXT, Fecha_Ult_Modif TEXT, Oper_Baja TEXT, Fecha_Baja TEXT,
      Es_Cve_Estado TEXT, Cl_Addenda_Pago TEXT, Cl_Formato_Venta TEXT, Cl_Cve_Regimen_Fiscal TEXT,
      Cl_Status_CRM TEXT NOT NULL DEFAULT 'CONTACTADO',
      Cl_Valor_CRM REAL NOT NULL DEFAULT 0,
      Cl_QuotedAmount_CRM REAL,
      Cl_InvoicedAmount_CRM REAL,
      Cl_CreatedAt_CRM TEXT NOT NULL,
      Cl_UpdatedAt_CRM TEXT NOT NULL
    )
  `);

  // Create Lead History table (mapped to Cliente)
  db.exec(`
    CREATE TABLE IF NOT EXISTS lead_history (
      id TEXT PRIMARY KEY,
      leadId TEXT NOT NULL,
      status TEXT NOT NULL,
      comment TEXT,
      evidenceUrl TEXT,
      quotedAmount REAL,
      invoicedAmount REAL,
      updatedBy TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (leadId) REFERENCES Cliente(Cl_Cve_Cliente) ON DELETE CASCADE
    )
  `);

  // Seed initial data if empty
  const userCount = db.prepare('SELECT COUNT(*) as count FROM Vendedor').get() as { count: number };
  if (userCount.count === 0) {
    const now = new Date().toISOString();

    // Seed lookup tables (5 rows each)
    const insertLookup = (table: string, pkCol: string, rows: [string, string][]) => {
      const stmt = db.prepare(`INSERT INTO ${table} (${pkCol}, Descripcion) VALUES (?, ?)`);
      rows.forEach(([id, desc]) => stmt.run(id, desc));
    };

    insertLookup('Estado', 'Es_Cve_Estado', [
      ['ES01', 'Ciudad de México'], ['ES02', 'Jalisco'], ['ES03', 'Nuevo León'],
      ['ES04', 'Puebla'], ['ES05', 'Querétaro']
    ]);
    insertLookup('Zona', 'Zn_Cve_Zona', [
      ['ZN01', 'Norte'], ['ZN02', 'Sur'], ['ZN03', 'Este'],
      ['ZN04', 'Oeste'], ['ZN05', 'Centro']
    ]);
    insertLookup('Empresa', 'Em_Cve_Empresa', [
      ['EM01', 'Empresa Principal'], ['EM02', 'Subsidiaria Norte'], ['EM03', 'Subsidiaria Sur'],
      ['EM04', 'Subsidiaria Este'], ['EM05', 'Subsidiaria Oeste']
    ]);
    insertLookup('Grupo_Sucursal', 'Gs_Cve_Grupo_Sucursal', [
      ['GS01', 'Grupo Sucursal A'], ['GS02', 'Grupo Sucursal B'], ['GS03', 'Grupo Sucursal C'],
      ['GS04', 'Grupo Sucursal D'], ['GS05', 'Grupo Sucursal E']
    ]);
    insertLookup('Grupo_Vendedor', 'Gv_Cve_Grupo_Vendedor', [
      ['GV01', 'Equipo Norte'], ['GV02', 'Equipo Sur'], ['GV03', 'Equipo Este'],
      ['GV04', 'Equipo Oeste'], ['GV05', 'Equipo Centro']
    ]);
    insertLookup('Giro_Comercial', 'Gm_Cve_Giro_Comercial', [
      ['GM01', 'Tecnología'], ['GM02', 'Manufactura'], ['GM03', 'Comercio'],
      ['GM04', 'Servicios'], ['GM05', 'Agricultura']
    ]);
    insertLookup('Grupo_Comercial', 'Gc_Cve_Grupo_Comercial', [
      ['GC01', 'Grupo A'], ['GC02', 'Grupo B'], ['GC03', 'Grupo C'],
      ['GC04', 'Grupo D'], ['GC05', 'Grupo E']
    ]);
    insertLookup('Cadena_Comercial', 'Cc_Cve_Cadena_Comercial', [
      ['CC01', 'Cadena A'], ['CC02', 'Cadena B'], ['CC03', 'Cadena C'],
      ['CC04', 'Cadena D'], ['CC05', 'Cadena E']
    ]);
    insertLookup('Promotor', 'Pr_Cve_Promotor', [
      ['PR01', 'Promotor 1'], ['PR02', 'Promotor 2'], ['PR03', 'Promotor 3'],
      ['PR04', 'Promotor 4'], ['PR05', 'Promotor 5']
    ]);
    insertLookup('Comisionista_Externo', 'Ce_Cve_Comisionista_Externo', [
      ['CE01', 'Comisionista 1'], ['CE02', 'Comisionista 2'], ['CE03', 'Comisionista 3'],
      ['CE04', 'Comisionista 4'], ['CE05', 'Comisionista 5']
    ]);
    insertLookup('Distribuidor', 'Ds_Cve_Distribuidor', [
      ['DS01', 'Distribuidor Norte'], ['DS02', 'Distribuidor Sur'], ['DS03', 'Distribuidor Este'],
      ['DS04', 'Distribuidor Oeste'], ['DS05', 'Distribuidor Centro']
    ]);
    insertLookup('Ruta', 'Rt_Cve_Ruta', [
      ['RT01', 'Ruta Norte'], ['RT02', 'Ruta Sur'], ['RT03', 'Ruta Este'],
      ['RT04', 'Ruta Oeste'], ['RT05', 'Ruta Centro']
    ]);
    insertLookup('Sector', 'Sc_Cve_Sector', [
      ['SCT01', 'Sector Industrial'], ['SCT02', 'Sector Comercial'], ['SCT03', 'Sector Servicios'],
      ['SCT04', 'Sector Agrícola'], ['SCT05', 'Sector Gobierno']
    ]);
    insertLookup('Tipo_Cliente', 'Tc_Cve_Tipo_Cliente', [
      ['TC01', 'Cliente Regular'], ['TC02', 'Cliente VIP'], ['TC03', 'Cliente Mayorista'],
      ['TC04', 'Cliente Minorista'], ['TC05', 'Cliente Nuevo']
    ]);

    // Seed Sucursales (5 rows)
    const insertSucursal = db.prepare('INSERT INTO Sucursal (Sc_Cve_Sucursal, Sc_Descripcion, Sc_Ciudad, Sc_Estado, Sc_Pais) VALUES (?, ?, ?, ?, ?)');
    insertSucursal.run('S001', 'CDMX',       'Ciudad de México', 'CDMX',       'México');
    insertSucursal.run('S002', 'Jalisco',     'Guadalajara',     'Jalisco',    'México');
    insertSucursal.run('S003', 'Nuevo León',  'Monterrey',       'Nuevo León', 'México');
    insertSucursal.run('S004', 'Puebla',      'Puebla',          'Puebla',     'México');
    insertSucursal.run('S005', 'Querétaro',   'Querétaro',       'Querétaro',  'México');

    // Seed Segmentos (5 rows)
    const insertSegmento = db.prepare('INSERT INTO Segmento (Sg_Cve_Segmento, Descripcion) VALUES (?, ?)');
    insertSegmento.run('SEG01', 'SIN SEGMENTO');
    insertSegmento.run('SEG02', 'AUTOCONTROL');
    insertSegmento.run('SEG03', 'CONTROLADORES DE PLAGAS');
    insertSegmento.run('SEG04', 'DISTRIBUIDORES');
    insertSegmento.run('SEG05', 'GRANOS ALMACENADOS');

    // Seed Vendedores (5 rows)
    const insertVendedor = db.prepare(`
      INSERT INTO Vendedor (Vn_Cve_Vendedor, Vn_Descripcion, Vn_Email, Vn_Rol_CRM, Vn_Meta_Ventas_CRM, Vn_Sucursal, Fecha_Alta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertVendedor.run('admin-1',  'Usuario Admin',    'admin@leadflow.com',  'Admin',  100000, 'S001', now);
    insertVendedor.run('seller-1', 'Alicia Torres',    'alicia@leadflow.com', 'Seller',  50000, 'S001', now);
    insertVendedor.run('seller-2', 'Carlos Ramírez',   'carlos@leadflow.com', 'Seller',  60000, 'S002', now);
    insertVendedor.run('seller-3', 'María López',      'maria@leadflow.com',  'Seller',  55000, 'S003', now);
    insertVendedor.run('seller-4', 'Roberto García',   'roberto@leadflow.com','Seller',  45000, 'S004', now);

    // Seed Clientes (5 rows, one per status stage)
    const insertCliente = db.prepare(`
      INSERT INTO Cliente (
        Cl_Cve_Cliente, Cl_Razon_Social, Cl_email_contacto_1, Cl_Contacto_1,
        Cl_Status_CRM, Vn_Cve_Vendedor, Cl_Valor_CRM, Sc_Cve_Sucursal, Sg_Cve_Segmento,
        Cl_CreatedAt_CRM, Cl_UpdatedAt_CRM
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCliente.run('lead-1', 'TechCorp SA de CV',      'juan@techcorp.mx',      'Juan Pérez',      'CONTACTADO',  null,       5000,  'S001', 'SEG03', now, now);
    insertCliente.run('lead-2', 'Innovate Ltd',           'juana@innovate.mx',     'Juana Smith',     'NEGOCIACION', 'seller-1', 12000, 'S002', 'SEG05', now, now);
    insertCliente.run('lead-3', 'Global Systems SA',      'roberto@global.mx',     'Roberto Wilson',  'COTIZADO',    'seller-2',  8000, 'S003', 'SEG04', now, now);
    insertCliente.run('lead-4', 'MegaTech SA de CV',      'ana@megatech.mx',       'Ana González',    'FACTURADO',   'seller-3', 25000, 'S004', 'SEG02', now, now);
    insertCliente.run('lead-5', 'DataSoft Inc',           'luis@datasoft.mx',      'Luis Hernández',  'ENTREGADO',   'seller-4', 18000, 'S005', 'SEG01', now, now);

    // Seed lead_history (5 rows)
    const insertHistory = db.prepare(`
      INSERT INTO lead_history (id, leadId, status, comment, updatedBy, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertHistory.run('h1', 'lead-2', 'NEGOCIACION', 'Cliente interesado, en negociación de precios',  'seller-1', now);
    insertHistory.run('h2', 'lead-3', 'COTIZADO',    'Cotización enviada por $8,000',                  'seller-2', now);
    insertHistory.run('h3', 'lead-4', 'COTIZADO',    'Cotización aprobada por el cliente',             'seller-3', now);
    insertHistory.run('h4', 'lead-4', 'FACTURADO',   'Factura emitida por $25,000',                    'seller-3', now);
    insertHistory.run('h5', 'lead-5', 'ENTREGADO',   'Producto entregado y cliente satisfecho',        'seller-4', now);
  }
}

export default db;

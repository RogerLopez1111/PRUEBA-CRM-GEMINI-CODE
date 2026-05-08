// ERP source: ECO_2020
// Column names in comments map to the ERP table columns they originate from.

export type LeadStatus = 'ASIGNADO' | 'CONTACTADO' | 'NEGOCIACION' | 'COTIZADO' | 'FACTURADO' | 'ENTREGADO' | 'RECHAZADO';

export interface LeadHistory {
  id: string;
  leadId: string;       // lead_history.lead_id
  status: LeadStatus;
  comment: string;
  evidenceUrl?: string;
  quotedAmount?: number;
  invoicedAmount?: number;
  rechazoMotivoId?: number;
  rechazoMotivo?: string;
  updatedBy: string;
  timestamp: string;
}

export interface RechazoMotivo {
  id: number;
  descripcion: string;
}

// Maps to Supabase `clientes` table, which mirrors ERP [dbo].[Cliente]
export interface Client {
  id: string;           // Cl_Cve_Cliente
  name: string;         // Cl_Contacto_1
  email: string;        // Cl_email_contacto_1
  company: string;      // Cl_Razon_Social (razón social / legal name)
  tradeName?: string;   // Cl_Descripcion (ERP "Nombre" / commercial / trade name)
  rfc?: string;         // Cl_R_F_C
  phone?: string;       // Cl_Telefono_1
  city?: string;        // Cl_Ciudad
  state?: string;       // Cl_Estado
  sucursalId?: string;  // Sc_Cve_Sucursal (from client record or most recent lead)
  segmentoId?: string;  // Sg_Cve_Segmento → FK to segmentos
  segmento?: string;    // resolved from segmentos.Sg_Descripcion
  createdAt: string;    // Fecha_Alta
  source?: 'erp' | 'crm'; // 'erp' = exists in SQL Server ECO_2020, 'crm' = CRM prospect only
}

// Maps to Supabase `leads` table (CRM-only, no ERP counterpart)
export interface Lead {
  id: string;
  clientId: string;     // Cl_Cve_Cliente → FK to clientes
  name: string;         // denormalized from clientes.Cl_Contacto_1
  email: string;        // denormalized from clientes.Cl_email_contacto_1
  company: string;      // denormalized from clientes.Cl_Razon_Social
  status: LeadStatus;   // Cl_Status_CRM
  assignedTo?: string;  // Vn_Cve_Vendedor → FK to vendedores
  value: number;        // Cl_Valor_CRM
  sucursal: string;     // Sc_Cve_Sucursal → resolved name from sucursales.Sc_Descripcion
  segmento: string;     // Sg_Cve_Segmento → resolved name from segmentos.Sg_Descripcion
  quotedAmount?: number;   // Cl_QuotedAmount_CRM
  invoicedAmount?: number; // Cl_InvoicedAmount_CRM
  clientInitiated?: boolean; // Cl_Client_Initiated_CRM — true when the customer reached out first
  mostrador?: boolean;       // Cl_Mostrador_CRM — true when the lead originated as a walk-in / counter inquiry
  newClient?: boolean;  // Cl_New_Client_CRM — true when this lead created a brand-new CRM prospect (survives the ERP re-point on FACTURADO)
  createdAt: string;    // Cl_CreatedAt_CRM
  updatedAt: string;    // Cl_UpdatedAt_CRM
  history: LeadHistory[];
}

// Maps to Supabase `vendedor_metas` table (CRM-only, no ERP counterpart)
export interface SalesGoal {
  id: string;
  vendedorId: string;   // Vn_Cve_Vendedor → FK to vendedores
  year: number;
  month: number;        // 1–12
  meta: number;
  invoiced: number;     // actual invoiced amount for that month
  status: "current" | "achieved" | "missed" | "future";
  createdAt: string;
}

// Maps to Supabase `vendedores` table, which mirrors ERP [dbo].[Vendedor]
// Vn_Perfil is reused from ERP to store the CRM role (Admin / Seller)
export interface User {
  id: string;           // Vn_Cve_Vendedor
  name: string;         // Vn_Descripcion
  email: string;        // Vn_Email
  role: 'Admin' | 'Seller' | 'Compras'; // Vn_Perfil — Compras only sees Pedidos Extraordinarios and can approve/reject
  sucursalId: string;   // Sc_Cve_Sucursal
  performance: {
    totalClosed: number;
    totalValue: number;
    conversionRate: number;
    salesGoal: number;  // from vendedor_metas (current month)
  };
  workload?: {
    activeLeads: number;
    pipelineValue: number;
  };
}

// Maps to Supabase `productos` table — Tier-1 mirror of ERP [dbo].[Producto]
export interface Product {
  id: string;            // Pr_Cve_Producto
  claveCorta?: string;   // Pr_Clave_Corta
  numeroParte?: string;  // Pr_Numero_Parte
  barras?: string;       // Pr_Barras
  descripcion: string;   // Pr_Descripcion
  descripcionCorta?: string; // Pr_Descripcion_Corta
  unidadVenta?: string;  // Pr_Unidad_Venta
  estado?: string;       // Es_Cve_Estado ('AC' | 'BA')
}

// Maps to Supabase `pedidos_extraordinarios` (CRM-only) — formal request to procure
// a product outside the regular buy windows because a client (tied to an active lead)
// is willing to wait up to 10 days. Distinct from faltantes (which are *lost* sales).
export type PedidoExtraordinarioEstado = 'solicitado' | 'aprobado' | 'pedido' | 'rechazado' | 'cancelado';
export interface PedidoExtraordinario {
  id: string;
  vendedorId: string;
  vendedorName?: string;
  sucursalId?: string;
  sucursalName?: string;
  leadId: string;
  leadCompany?: string;
  leadStatus?: LeadStatus;
  clienteId: string | null;     // denormalized from lead.clientId
  clienteName?: string | null;
  productoId?: string | null;
  productoDescripcion: string;
  cantidad: number;
  valorEstimado: number;        // estimated sale value if fulfilled
  compromisoDias: number;       // 1..10 — days client is willing to wait
  justificacion: string;
  estado: PedidoExtraordinarioEstado;
  resolucionComentario?: string;  // comment from admin when approved/rejected
  resueltoPor?: string;           // admin user id who resolved
  resueltoPorName?: string;
  resueltoAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Maps to Supabase `productos_faltantes` (CRM-only) — log of stock-out lost sales
export type ProductoFaltanteEstado = 'pendiente' | 'resuelto';
export interface ProductoFaltante {
  id: string;
  vendedorId: string;     // Vn_Cve_Vendedor
  vendedorName?: string;
  sucursalId?: string;    // Sc_Cve_Sucursal
  sucursalName?: string;
  clienteId?: string | null; // Cl_Cve_Cliente — optional
  clienteName?: string | null;
  productoId?: string | null; // Pr_Cve_Producto — null when free-typed
  productoDescripcion: string; // snapshot at log time
  cantidad: number;
  comentario: string;
  estado: ProductoFaltanteEstado;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceMetric {
  userId: string;
  userName: string;
  leadsAssigned: number;
  leadsClosed: number;
  revenue: number;
}

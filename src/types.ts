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
  updatedBy: string;
  timestamp: string;
}

// Maps to Supabase `clientes` table, which mirrors ERP [dbo].[Cliente]
export interface Client {
  id: string;           // Cl_Cve_Cliente
  name: string;         // Cl_Contacto_1
  email: string;        // Cl_email_contacto_1
  company: string;      // Cl_Razon_Social
  rfc?: string;         // Cl_R_F_C
  phone?: string;       // Cl_Telefono_1
  city?: string;        // Cl_Ciudad
  state?: string;       // Cl_Estado
  sucursalId?: string;  // Sc_Cve_Sucursal (from client record or most recent lead)
  createdAt: string;    // Fecha_Alta
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
  createdAt: string;
}

// Maps to Supabase `vendedores` table, which mirrors ERP [dbo].[Vendedor]
// Vn_Perfil is reused from ERP to store the CRM role (Admin / Seller)
export interface User {
  id: string;           // Vn_Cve_Vendedor
  name: string;         // Vn_Descripcion
  email: string;        // Vn_Email
  role: 'Admin' | 'Seller'; // Vn_Perfil
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

export interface PerformanceMetric {
  userId: string;
  userName: string;
  leadsAssigned: number;
  leadsClosed: number;
  revenue: number;
}

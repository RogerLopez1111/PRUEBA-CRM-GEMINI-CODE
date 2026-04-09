export type LeadStatus = 'ASIGNADO' | 'CONTACTADO' | 'NEGOCIACION' | 'COTIZADO' | 'FACTURADO' | 'ENTREGADO' | 'RECHAZADO';

export interface LeadHistory {
  id: string;
  leadId: string;
  status: LeadStatus;
  comment: string;
  evidenceUrl?: string;
  quotedAmount?: number;
  invoicedAmount?: number;
  updatedBy: string;
  timestamp: string;
}

export interface Lead {
  id: string; // Cl_Cve_Cliente
  name: string; // Cl_Contacto_1
  email: string; // Cl_email_contacto_1
  company: string; // Cl_Razon_Social
  status: LeadStatus; // Cl_Status_CRM
  assignedTo?: string; // Vn_Cve_Vendedor
  value: number; // Cl_Valor_CRM
  sucursal: string; // Sc_Cve_Sucursal
  segmento: string; // Sg_Cve_Segmento
  quotedAmount?: number; // Cl_QuotedAmount_CRM
  invoicedAmount?: number; // Cl_InvoicedAmount_CRM
  createdAt: string; // Cl_CreatedAt_CRM
  updatedAt: string; // Cl_UpdatedAt_CRM
  history: LeadHistory[];
  
  // New fields from script (partial list of most relevant ones)
  Cl_Razon_Social?: string;
  Cl_R_F_C?: string;
  Cl_Telefono_1?: string;
  Cl_Ciudad?: string;
  Cl_Estado?: string;
}

export interface User {
  id: string; // Vn_Cve_Vendedor
  name: string; // Vn_Descripcion
  email: string; // Vn_Email
  role: 'Admin' | 'Seller'; // Vn_Rol_CRM
  performance: {
    totalClosed: number;
    totalValue: number;
    conversionRate: number;
    salesGoal: number; // Vn_Meta_Ventas_CRM
  };
  workload?: {
    activeLeads: number;
    pipelineValue: number;
  };
  Vn_Sucursal?: string;
}

export interface PerformanceMetric {
  userId: string;
  userName: string;
  leadsAssigned: number;
  leadsClosed: number;
  revenue: number;
}

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

export interface Client {
  id: string;
  name: string;
  email: string;
  company: string;
  phone?: string;
  rfc?: string;
  city?: string;
  state?: string;
  sucursalId?: string; // from most recent lead, used for pre-fill in new lead dialog
  createdAt: string;
}

export interface Lead {
  id: string;
  clientId: string;
  name: string;       // denormalized from clientes.contacto
  email: string;      // denormalized from clientes.email
  company: string;    // denormalized from clientes.razon_social
  status: LeadStatus;
  assignedTo?: string;
  value: number;
  sucursal: string;
  segmento: string;
  quotedAmount?: number;
  invoicedAmount?: number;
  createdAt: string;
  updatedAt: string;
  history: LeadHistory[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Seller';
  sucursalId: string;
  performance: {
    totalClosed: number;
    totalValue: number;
    conversionRate: number;
    salesGoal: number;
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

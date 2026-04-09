export type LeadStatus = 'ASIGNADO' | 'CONTACTADO' | 'NEGOCIACION' | 'COTIZADO' | 'FACTURADO' | 'ENTREGADO' | 'RECHAZADO';

export interface LeadHistory {
  id: string;
  status: LeadStatus;
  comment: string;
  evidenceUrl?: string;
  quotedAmount?: number;
  invoicedAmount?: number;
  updatedBy: string;
  timestamp: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  status: LeadStatus;
  assignedTo?: string; // User ID
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
}

export interface PerformanceMetric {
  userId: string;
  userName: string;
  leadsAssigned: number;
  leadsClosed: number;
  revenue: number;
}

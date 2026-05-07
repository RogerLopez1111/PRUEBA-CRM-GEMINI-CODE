/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  BarChart3,
  UserCheck,
  ShieldCheck,
  LogOut,
  LogIn,
  Settings,
  Kanban,
  History,
  FileText,
  ExternalLink,
  MessageSquare,
  Paperclip,
  ChevronRight,
  Target,
  Building2,
  Bell,
  XCircle
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Lead, User, LeadStatus, Client, SalesGoal, Product, ProductoFaltante } from "./types";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';

function KanbanColumn({ status, leads, users, onUpdate, getStatusBadge }: { key?: string, status: LeadStatus, leads: Lead[], users: User[], onUpdate: (lead: Lead, newStatus?: LeadStatus) => void, getStatusBadge: (status: LeadStatus) => React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div key={status} className="flex-shrink-0 w-[260px] sm:w-72 md:w-80 flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-base text-brand-navy">{status}</h3>
          <Badge variant="secondary" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]">
            {leads.filter(l => l.status === status).length}
          </Badge>
        </div>
      </div>
      
      <SortableContext
        id={status}
        items={leads.filter(l => l.status === status).map(l => l.id)}
        strategy={verticalListSortingStrategy}
      >
        <div 
          ref={setNodeRef}
          className="flex-1 rounded-xl p-2 space-y-3 border border-dashed border-[#141456]/20 min-h-[200px]" style={{backgroundColor: "rgba(20,20,86,0.06)"}}
        >
          {leads.filter(l => l.status === status).map((lead) => (
            <SortableLeadCard 
              key={lead.id} 
              lead={lead} 
              users={users} 
              onUpdate={() => onUpdate(lead)} 
              getStatusBadge={getStatusBadge}
            />
          ))}
          {leads.filter(l => l.status === status).length === 0 && (
            <div className="h-24 flex items-center justify-center text-xs text-slate-400 italic">
              No leads here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

const STATUS_ACCENT: Record<LeadStatus, { bar: string; valueBg: string; valueText: string }> = {
  ASIGNADO:    { bar: "bg-slate-400",   valueBg: "bg-slate-50",   valueText: "text-slate-700"  },
  CONTACTADO:  { bar: "bg-blue-500",    valueBg: "bg-blue-50",    valueText: "text-blue-700"   },
  NEGOCIACION: { bar: "bg-purple-500",  valueBg: "bg-purple-50",  valueText: "text-purple-700" },
  COTIZADO:    { bar: "bg-orange-500",  valueBg: "bg-orange-50",  valueText: "text-orange-700" },
  FACTURADO:   { bar: "bg-indigo-500",  valueBg: "bg-indigo-50",  valueText: "text-indigo-700" },
  ENTREGADO:   { bar: "bg-emerald-500", valueBg: "bg-emerald-50", valueText: "text-emerald-700"},
  RECHAZADO:   { bar: "bg-red-500",     valueBg: "bg-red-50",     valueText: "text-red-700"    },
};

function SortableLeadCard({ lead, users, onUpdate, getStatusBadge: _getStatusBadge }: { key?: string, lead: Lead, users: User[], onUpdate: () => void, getStatusBadge: (status: LeadStatus) => React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const seller = lead.assignedTo ? users.find(u => u.id === lead.assignedTo) : null;
  const accent = STATUS_ACCENT[lead.status] || STATUS_ACCENT.ASIGNADO;

  const daysSince = Math.floor((Date.now() - new Date(lead.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  const isStale = (lead.status === "ASIGNADO" && daysSince >= 3) || (lead.status === "COTIZADO" && daysSince >= 5);
  const timeLabel = daysSince === 0 ? "Hoy" : daysSince === 1 ? "Ayer" : `${daysSince}d`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => { if (!isDragging) onUpdate(); }}
      className="relative bg-white rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors group overflow-hidden"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent.bar}`} />

      <div className="pl-4 pr-3 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-semibold text-sm text-slate-900 leading-tight line-clamp-2 group-hover:text-[#141456] transition-colors">
            {lead.company || lead.name}
          </h4>
          <span className={`shrink-0 text-[11px] font-semibold font-mono px-2 py-0.5 rounded-md ${accent.valueBg} ${accent.valueText}`}>
            ${lead.value.toLocaleString()}
          </span>
        </div>

        {(lead.segmento || lead.sucursal || lead.mostrador) && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {lead.mostrador && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
                Mostrador
              </span>
            )}
            {lead.segmento && (
              <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                {lead.segmento}
              </span>
            )}
            {lead.sucursal && (
              <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                {lead.sucursal}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 min-w-0">
            {seller ? (
              <>
                <div
                  className="w-5 h-5 rounded-full bg-[#141456]/10 flex items-center justify-center text-[9px] font-bold text-[#141456] shrink-0"
                  title={seller.name}
                >
                  {seller.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[11px] text-slate-600 truncate">{seller.name}</span>
              </>
            ) : (
              <span className="text-[10px] italic text-slate-400">Sin asignar</span>
            )}
          </div>
          <div className={`flex items-center gap-1 text-[10px] font-medium shrink-0 ${isStale ? "text-red-500" : "text-slate-400"}`}>
            <Clock className="w-3 h-3" />
            <span>{timeLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// CRM-only client IDs are random alphanumeric (created in the new-lead flow);
// ERP clients have all-numeric ids.
const isCrmClientId = (id: string | undefined | null) => !!id && !/^\d+$/.test(id);

// For a list of leads belonging to one seller, returns Map<"YYYY-MM", count>
// of brand-new clients the seller brought on. Attribution is anchored to the
// lead.newClient flag (Cl_New_Client_CRM) — set true when the lead was created
// against a brand-new prospect — so credit survives the ERP re-point that
// happens on FACTURADO. The clientId itself can flip from CRM-alphanumeric to
// ERP-numeric, which would otherwise erase historical credit.
function newClientsByMonth(sellerLeads: Lead[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const l of sellerLeads) {
    if (!l.newClient) continue;
    const d = new Date(l.createdAt);
    if (isNaN(d.getTime())) continue;
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    counts.set(ym, (counts.get(ym) || 0) + 1);
  }
  return counts;
}

const currentYearMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const getTimeStuck = (updatedAt: string) => {
  const lastUpdate = new Date(updatedAt).getTime();
  const now = new Date().getTime();
  const diffInMs = now - lastUpdate;
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays > 0) return `${diffInDays}d ${diffInHours % 24}h`;
  if (diffInHours > 0) return `${diffInHours}h`;
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  return `${diffInMinutes}m`;
};

const getStuckLevel = (updatedAt: string) => {
  const lastUpdate = new Date(updatedAt).getTime();
  const now = new Date().getTime();
  const diffInHours = (now - lastUpdate) / (1000 * 60 * 60);
  if (diffInHours > 72) return "critical";
  if (diffInHours > 24) return "warning";
  return "normal";
};

// Median days between the first ASIGNADO and the first CONTACTADO history entry.
function timeToFirstContact(leads: Lead[]): { median: number | null; count: number } {
  const days: number[] = [];
  for (const l of leads) {
    const asig = l.history.find(h => h.status === "ASIGNADO");
    const cont = l.history.find(h => h.status === "CONTACTADO");
    if (!asig || !cont) continue;
    const diff = (new Date(cont.timestamp).getTime() - new Date(asig.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    if (isFinite(diff) && diff >= 0) days.push(diff);
  }
  if (days.length === 0) return { median: null, count: 0 };
  const sorted = [...days].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return { median, count: sorted.length };
}

// Pareto of rechazo motivos for a set of leads — lost value (pesos) drives the order.
function rechazoMotivosPareto(leads: Lead[]): { name: string; count: number; lostValue: number }[] {
  const map = new Map<string, { count: number; lostValue: number }>();
  for (const l of leads) {
    if (l.status !== "RECHAZADO") continue;
    const lastRej = [...l.history].reverse().find(h => h.status === "RECHAZADO");
    const motivo = lastRej?.rechazoMotivo || "Sin motivo";
    const ex = map.get(motivo) || { count: 0, lostValue: 0 };
    ex.count += 1;
    ex.lostValue += l.value || 0;
    map.set(motivo, ex);
  }
  return [...map.entries()]
    .map(([name, v]) => ({ name, count: v.count, lostValue: v.lostValue }))
    .sort((a, b) => b.lostValue - a.lostValue || b.count - a.count);
}

// Stage-by-stage funnel. For each lead, the deepest stage it ever touched
// (via current status or any history entry) counts toward every prior stage.
// RECHAZADO is treated as a terminal off-funnel state, not a stage.
const FUNNEL_STAGES: LeadStatus[] = ["ASIGNADO", "CONTACTADO", "NEGOCIACION", "COTIZADO", "FACTURADO", "ENTREGADO"];
function funnelByStage(leads: Lead[]): { stage: LeadStatus; count: number; pctOfTop: number; stepConversion: number | null }[] {
  const counts: Record<string, number> = {};
  for (const s of FUNNEL_STAGES) counts[s] = 0;
  for (const l of leads) {
    let deepest = -1;
    for (const h of l.history) {
      const i = FUNNEL_STAGES.indexOf(h.status as LeadStatus);
      if (i > deepest) deepest = i;
    }
    const cur = FUNNEL_STAGES.indexOf(l.status as LeadStatus);
    if (cur > deepest) deepest = cur;
    if (deepest < 0) continue;
    for (let i = 0; i <= deepest; i++) counts[FUNNEL_STAGES[i]] += 1;
  }
  const top = counts[FUNNEL_STAGES[0]] || 1;
  return FUNNEL_STAGES.map((stage, idx) => {
    const prev = idx === 0 ? null : counts[FUNNEL_STAGES[idx - 1]];
    const stepConversion = prev && prev > 0 ? (counts[stage] / prev) * 100 : (idx === 0 ? null : null);
    return {
      stage,
      count: counts[stage],
      pctOfTop: top > 0 ? (counts[stage] / top) * 100 : 0,
      stepConversion,
    };
  });
}

const formatDays = (d: number) => {
  if (d < 1) {
    const hours = Math.round(d * 24);
    return `${hours}h`;
  }
  if (d < 10) return `${d.toFixed(1)}d`;
  return `${Math.round(d)}d`;
};

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sucursales, setSucursales] = useState<{id: string, name: string}[]>([]);
  const [segmentos, setSegmentos] = useState<{id: string, name: string}[]>([]);
  const [rechazoMotivos, setRechazoMotivos] = useState<{ id: number; descripcion: string }[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [faltantes, setFaltantes] = useState<ProductoFaltante[]>([]);
  const [isFaltanteOpen, setIsFaltanteOpen] = useState(false);
  const [isProductoSearchOpen, setIsProductoSearchOpen] = useState(false);
  const [productoSearch, setProductoSearch] = useState("");
  const [isFaltanteClientSearchOpen, setIsFaltanteClientSearchOpen] = useState(false);
  const [faltanteClientSearch, setFaltanteClientSearch] = useState("");
  const [newFaltante, setNewFaltante] = useState<{
    productoId: string;
    productoDescripcion: string;
    cantidad: number;
    comentario: string;
    clienteId: string;
    clienteName: string;
  }>({ productoId: "", productoDescripcion: "", cantidad: 0, comentario: "", clienteId: "", clienteName: "" });
  const [editingFaltanteId, setEditingFaltanteId] = useState<string | null>(null);
  const [faltantesFilterSucursal, setFaltantesFilterSucursal] = useState<string>("all");
  const [faltantesFilterMonth, setFaltantesFilterMonth] = useState<string>("all");
  const [faltantesFilterEstado, setFaltantesFilterEstado] = useState<"all" | "pendiente" | "resuelto">("all");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isClientSearchOpen, setIsClientSearchOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [isSellerSearchOpen, setIsSellerSearchOpen] = useState(false);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    name: "",
    email: "",
    company: "",
    value: 0,
    sucursal: "",
    segmento: "",
    isExistingClient: false,
    clientId: "",
    assignedTo: "",
    clientInitiated: false,
    mostrador: false,
  });
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Seller" as "Admin" | "Seller", salesGoal: 50000, sucursal: "" });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isStatusUpdateOpen, setIsStatusUpdateOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [statusUpdate, setStatusUpdate] = useState({
    status: "" as LeadStatus,
    comment: "",
    evidenceUrl: "",
    quotedAmount: 0,
    invoicedAmount: 0,
    rechazoMotivoId: 0,
    erpClientId: "",
  });
  const [isErpClientSearchOpen, setIsErpClientSearchOpen] = useState(false);
  const [erpClientSearch, setErpClientSearch] = useState("");

  // Admin Hub Filters
  const [adminFilterSeller, setAdminFilterSeller] = useState<string>("all");
  const [adminFilterSucursal, setAdminFilterSucursal] = useState<string>("all");
  const [adminFilterSegmento, setAdminFilterSegmento] = useState<string>("all");
  const [adminSearch, setAdminSearch] = useState("");
  const [myLeadsSearch, setMyLeadsSearch] = useState("");

  // Kanban Filters
  const [kanbanFilterSeller, setKanbanFilterSeller] = useState<string>("all");
  const [kanbanFilterSucursal, setKanbanFilterSucursal] = useState<string>("all");
  const [kanbanFilterSegmento, setKanbanFilterSegmento] = useState<string>("all");
  const [kanbanSearch, setKanbanSearch] = useState("");
  const [kanbanFilterMonth, setKanbanFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Performance Filters
  const [perfUserFilter, setPerfUserFilter] = useState<string>("all");

  // Admin Sub-tabs
  const [adminSubTab, setAdminSubTab] = useState<string>("users");

  // User Detail Dialog
  const [selectedUserDetail, setSelectedUserDetail] = useState<User | null>(null);
  const [userDetailEmail, setUserDetailEmail] = useState("");
  const [userDetailPassword, setUserDetailPassword] = useState("");
  const [userDetailSucursal, setUserDetailSucursal] = useState("");
  const [userGoalsTimeline, setUserGoalsTimeline] = useState<SalesGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  // For seller's own timeline view
  const [myGoalsTimeline, setMyGoalsTimeline] = useState<SalesGoal[]>([]);

  // Branch Goal
  const [branchGoal, setBranchGoal] = useState({ sucursalId: "", month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: 0 });

  // DND State
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const faltantesMonthOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    for (const f of faltantes) {
      const d = new Date(f.createdAt);
      if (!isNaN(d.getTime())) {
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [faltantes]);

  const filteredFaltantes = useMemo(() => {
    return faltantes.filter(f => {
      if (currentUser?.role === "Seller" && f.vendedorId !== currentUser.id) return false;
      if (faltantesFilterEstado !== "all" && f.estado !== faltantesFilterEstado) return false;
      if (faltantesFilterSucursal !== "all" && f.sucursalName !== faltantesFilterSucursal) return false;
      if (faltantesFilterMonth !== "all") {
        const d = new Date(f.createdAt);
        if (isNaN(d.getTime())) return false;
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (ym !== faltantesFilterMonth) return false;
      }
      return true;
    });
  }, [faltantes, currentUser, faltantesFilterEstado, faltantesFilterSucursal, faltantesFilterMonth]);

  // Admin rollup aggregations — derived from the same filtered set so the
  // rollup and the list always agree.
  const faltantesRollup = useMemo(() => {
    type ProductAgg = { name: string; productoId: string | null; incidentes: number; cantidad: number; sucursales: Set<string> };
    const productAgg = new Map<string, ProductAgg>();
    const sucursalAgg = new Map<string, { incidentes: number; products: Map<string, number> }>();
    const clienteAgg = new Map<string, { name: string; incidentes: number; cantidad: number }>();
    let freeTextCount = 0;

    for (const f of filteredFaltantes) {
      const productKey = f.productoId || `__free:${f.productoDescripcion.toLowerCase().trim()}`;
      const productName = f.productoDescripcion;
      const p = productAgg.get(productKey) || { name: productName, productoId: f.productoId ?? null, incidentes: 0, cantidad: 0, sucursales: new Set<string>() };
      p.incidentes += 1;
      p.cantidad += Number(f.cantidad) || 0;
      if (f.sucursalName) p.sucursales.add(f.sucursalName);
      productAgg.set(productKey, p);

      if (f.sucursalName) {
        const s = sucursalAgg.get(f.sucursalName) || { incidentes: 0, products: new Map<string, number>() };
        s.incidentes += 1;
        s.products.set(productName, (s.products.get(productName) || 0) + 1);
        sucursalAgg.set(f.sucursalName, s);
      }

      if (!f.productoId) freeTextCount += 1;

      if (f.clienteId && f.clienteName) {
        const c = clienteAgg.get(f.clienteId) || { name: f.clienteName, incidentes: 0, cantidad: 0 };
        c.incidentes += 1;
        c.cantidad += Number(f.cantidad) || 0;
        clienteAgg.set(f.clienteId, c);
      }
    }

    const topProducts = [...productAgg.values()]
      .sort((a, b) => b.incidentes - a.incidentes || b.cantidad - a.cantidad)
      .slice(0, 10);

    const bySucursal = [...sucursalAgg.entries()]
      .map(([name, v]) => {
        const top = [...v.products.entries()].sort((a, b) => b[1] - a[1])[0];
        return { name, incidentes: v.incidentes, topProduct: top ? top[0] : null, topProductCount: top ? top[1] : 0 };
      })
      .sort((a, b) => b.incidentes - a.incidentes);

    const topClientes = [...clienteAgg.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.incidentes - a.incidentes || b.cantidad - a.cantidad)
      .slice(0, 8);

    const totalIncidentes = filteredFaltantes.length;
    const freeTextPct = totalIncidentes ? Math.round((freeTextCount / totalIncidentes) * 100) : 0;

    // Cross-month metrics (recurrencia, productos nuevos del mes actual) ignore
    // the month filter and only respect role + sucursal scoping so they stay
    // meaningful regardless of which month the admin is inspecting.
    const norm = (v?: string) => (v || "").trim();
    const crossScopeBase = faltantes.filter(f => {
      if (currentUser?.role === "Seller" && f.vendedorId !== currentUser.id) return false;
      if (faltantesFilterSucursal !== "all" && f.sucursalName !== faltantesFilterSucursal) return false;
      return true;
    });

    const now = new Date();
    const currYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currLabel = `${MESES[now.getMonth()].slice(0, 3)} ${String(now.getFullYear()).slice(2)}`;

    const productMonthSet = new Map<string, Set<string>>();
    const productFirstSeen = new Map<string, string>();
    const productNamesXM = new Map<string, string>();
    const productIdsXM = new Map<string, string | null>();
    const productCantidadCurrMonth = new Map<string, number>();
    const productIncidentesCurrMonth = new Map<string, number>();

    for (const f of crossScopeBase) {
      const d = new Date(f.createdAt);
      if (isNaN(d.getTime())) continue;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const key = f.productoId || `__free:${norm(f.productoDescripcion).toLowerCase()}`;
      const set = productMonthSet.get(key) || new Set<string>();
      set.add(ym);
      productMonthSet.set(key, set);
      productNamesXM.set(key, f.productoDescripcion);
      productIdsXM.set(key, f.productoId ?? null);
      const earliest = productFirstSeen.get(key);
      if (!earliest || ym < earliest) productFirstSeen.set(key, ym);

      if (ym === currYm) {
        productCantidadCurrMonth.set(key, (productCantidadCurrMonth.get(key) || 0) + (Number(f.cantidad) || 0));
        productIncidentesCurrMonth.set(key, (productIncidentesCurrMonth.get(key) || 0) + 1);
      }
    }

    const recurrentes = [...productMonthSet.entries()]
      .filter(([, months]) => months.size >= 3)
      .map(([key, months]) => ({
        key,
        name: productNamesXM.get(key) || key,
        productoId: productIdsXM.get(key) || null,
        meses: months.size,
      }))
      .sort((a, b) => b.meses - a.meses)
      .slice(0, 8);

    const productosNuevos = [...productCantidadCurrMonth.keys()]
      .filter(key => productFirstSeen.get(key) === currYm)
      .map(key => ({
        key,
        name: productNamesXM.get(key) || key,
        productoId: productIdsXM.get(key) || null,
        cantidad: productCantidadCurrMonth.get(key) || 0,
        incidentes: productIncidentesCurrMonth.get(key) || 0,
      }))
      .sort((a, b) => b.incidentes - a.incidentes || b.cantidad - a.cantidad)
      .slice(0, 8);

    return {
      topProducts,
      bySucursal,
      totalIncidentes,
      freeTextPct,
      freeTextCount,
      topClientes,
      currLabel,
      recurrentes,
      productosNuevos,
    };
  }, [filteredFaltantes, faltantes, currentUser, faltantesFilterSucursal]);

  // Admin "Carga de Trabajo" insights — per-vendedor stats and the stuck-leads
  // intervention pile. Reuses the admin filters already on screen (search,
  // vendedor, sucursal). Estado is intentionally not used here: workload is
  // about active and stuck leads, not arbitrary statuses.
  const workloadInsights = useMemo(() => {
    const isActive = (s: LeadStatus) => s !== "FACTURADO" && s !== "ENTREGADO" && s !== "RECHAZADO";
    const isClosed = (s: LeadStatus) => s === "FACTURADO" || s === "ENTREGADO";
    const now = new Date();
    const currYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const sucursalIdFilter: string | null = adminFilterSucursal === "all" ? null : (sucursales.find((s: { id: string; name: string }) => s.name === adminFilterSucursal)?.id || null);
    const vendedorIdFilter: string | null = adminFilterSeller !== "all" && adminFilterSeller !== "unassigned" ? adminFilterSeller : null;
    const q = adminSearch.trim().toLowerCase();

    const matchUserSearch = (u: User) => !q || u.name.toLowerCase().includes(q);

    const filteredUsers: User[] = users.filter((u: User) => {
      if (sucursalIdFilter && u.sucursalId !== sucursalIdFilter) return false;
      if (vendedorIdFilter && u.id !== vendedorIdFilter) return false;
      if (!matchUserSearch(u)) return false;
      return true;
    });

    type WorkloadStat = {
      user: User;
      sucursalName: string;
      activeLeads: number;
      pipelineValue: number;
      stuckCount: number;
      closedThisMonth: number;
      convPct: number;
    };
    const stats: WorkloadStat[] = filteredUsers.map((u: User) => {
      const userLeads: Lead[] = leads.filter((l: Lead) => l.assignedTo === u.id);
      const activeLeads: Lead[] = userLeads.filter((l: Lead) => isActive(l.status));
      const pipelineValue = activeLeads.reduce((acc: number, l: Lead) => acc + (l.value || 0), 0);
      const stuckCount = activeLeads.filter((l: Lead) => getStuckLevel(l.updatedAt) !== "normal").length;
      const closedThisMonth = userLeads.filter((l: Lead) => {
        if (!isClosed(l.status)) return false;
        const d = new Date(l.updatedAt);
        if (isNaN(d.getTime())) return false;
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currYm;
      }).length;
      const closedTotal = userLeads.filter((l: Lead) => isClosed(l.status)).length;
      const convPct = userLeads.length ? Math.round((closedTotal / userLeads.length) * 100) : 0;
      return {
        user: u,
        sucursalName: sucursales.find((s: { id: string; name: string }) => s.id === u.sucursalId)?.name || "—",
        activeLeads: activeLeads.length,
        pipelineValue,
        stuckCount,
        closedThisMonth,
        convPct,
      };
    }).sort((a: WorkloadStat, b: WorkloadStat) => b.activeLeads - a.activeLeads || b.pipelineValue - a.pipelineValue);

    const teamAvgConv = stats.length ? Math.round(stats.reduce((acc: number, x: WorkloadStat) => acc + x.convPct, 0) / stats.length) : 0;

    const rank = (lvl: string) => lvl === "critical" ? 0 : lvl === "warning" ? 1 : 2;
    const stuckLeads: Lead[] = leads.filter((l: Lead) => {
      if (!isActive(l.status)) return false;
      if (getStuckLevel(l.updatedAt) === "normal") return false;
      if (vendedorIdFilter && l.assignedTo !== vendedorIdFilter) return false;
      if (adminFilterSeller === "unassigned" && l.assignedTo) return false;
      if (sucursalIdFilter) {
        const owner = users.find((u: User) => u.id === l.assignedTo);
        if (!owner || owner.sucursalId !== sucursalIdFilter) return false;
      }
      if (q && !l.name.toLowerCase().includes(q) && !l.company.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a: Lead, b: Lead) => {
      const la = getStuckLevel(a.updatedAt), lb = getStuckLevel(b.updatedAt);
      if (rank(la) !== rank(lb)) return rank(la) - rank(lb);
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    });

    return { stats, teamAvgConv, stuckLeads };
  }, [leads, users, sucursales, adminFilterSeller, adminFilterSucursal, adminSearch]);

  const kanbanMonthOptions = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    set.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    for (const l of leads) {
      const d = new Date(l.updatedAt);
      if (!isNaN(d.getTime())) {
        set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
    }
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [leads]);

  const notifications = useMemo(() => {
    if (!currentUser) return [] as Array<{ id: string; leadId: string; kind: "stale-assignment" | "stale-quote"; lead: Lead; days: number; sellerName: string }>;
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;
    const visible = currentUser.role === "Admin"
      ? leads
      : leads.filter(l => l.assignedTo === currentUser.id);
    const out: Array<{ id: string; leadId: string; kind: "stale-assignment" | "stale-quote"; lead: Lead; days: number; sellerName: string }> = [];
    for (const lead of visible) {
      if (!lead.assignedTo) continue;
      const days = Math.floor((now - new Date(lead.updatedAt).getTime()) / DAY);
      const sellerName = users.find(u => u.id === lead.assignedTo)?.name || "Sin asignar";
      if (lead.status === "ASIGNADO" && days >= 3) {
        out.push({ id: `assign-${lead.id}`, leadId: lead.id, kind: "stale-assignment", lead, days, sellerName });
      } else if (lead.status === "COTIZADO" && days >= 5) {
        out.push({ id: `quote-${lead.id}`, leadId: lead.id, kind: "stale-quote", lead, days, sellerName });
      }
    }
    return out.sort((a, b) => b.days - a.days);
  }, [leads, users, currentUser]);

  useEffect(() => {
    const savedUser = localStorage.getItem("ecosistemas_crm_user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      if (user.role === "Seller") {
        setPerfUserFilter(user.id);
        fetchGoalsTimeline(user.id, setMyGoalsTimeline);
      }
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, usersRes, clientsRes, sucursalesRes, segmentosRes, motivosRes, productosRes, faltantesRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/users"),
        fetch("/api/clients"),
        fetch("/api/lookups/sucursales"),
        fetch("/api/lookups/segmentos"),
        fetch("/api/lookups/rechazo-motivos"),
        fetch("/api/productos"),
        fetch("/api/productos-faltantes")
      ]);

      const safeJson = async (res: Response, fallback: any) => {
        try { return res.ok ? await res.json() : fallback; }
        catch { return fallback; }
      };

      const leadsData = await safeJson(leadsRes, []);
      const usersData = await safeJson(usersRes, []);
      const clientsData = await safeJson(clientsRes, []);
      const sucursalesData = await safeJson(sucursalesRes, []);
      const segmentosData = await safeJson(segmentosRes, []);
      const motivosData = await safeJson(motivosRes, []);
      const productosData = await safeJson(productosRes, []);
      const faltantesData = await safeJson(faltantesRes, []);

      setLeads(leadsData);
      setUsers(usersData);
      setClients(clientsData);
      setSucursales(sucursalesData);
      setSegmentos(segmentosData);
      setRechazoMotivos(motivosData);
      setProductos(productosData);
      setFaltantes(faltantesData);

      // Set defaults for new lead if not already set
      setNewLead(prev => ({
        ...prev,
        sucursal: prev.sucursal || (currentUser?.role === "Seller" ? sucursalesData.find((s: any) => s.id === currentUser.sucursalId)?.name : "") || (sucursalesData.length > 0 ? sucursalesData[0].name : ""),
        segmento: prev.segmento || (segmentosData.length > 0 ? segmentosData[0].name : "")
      }));

      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Error al cargar los datos");
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        if (user.role === "Seller") setPerfUserFilter(user.id);
        else setPerfUserFilter("all");
        localStorage.setItem("ecosistemas_crm_user", JSON.stringify(user));
        toast.success(`Bienvenido de nuevo, ${user.name}`);
        if (user.role === "Seller") fetchGoalsTimeline(user.id, setMyGoalsTimeline);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Correo o contraseña incorrectos");
      }
    } catch (error) {
      toast.error("Error al iniciar sesión");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("ecosistemas_crm_user");
    toast.info("Sesión cerrada exitosamente");
  };


  const handleStatusChange = async (
    leadId: string,
    status: LeadStatus,
    comment?: string,
    evidenceUrl?: string,
    quotedAmount?: number,
    invoicedAmount?: number,
    rechazoMotivoId?: number,
    erpClientId?: string
  ) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          comment,
          evidenceUrl,
          quotedAmount,
          invoicedAmount,
          rechazoMotivoId,
          erpClientId,
          userId: currentUser?.id
        })
      });
      if (res.ok) {
        if (status === "FACTURADO") {
          toast.success("Lead facturado y vinculado al cliente ERP");
        } else {
          toast.success(`Lead marcado como ${status}`);
        }
        setIsStatusUpdateOpen(false);
        setStatusUpdate({
          status: "" as LeadStatus,
          comment: "",
          evidenceUrl: "",
          quotedAmount: 0,
          invoicedAmount: 0,
          rechazoMotivoId: 0,
          erpClientId: "",
        });
        setErpClientSearch("");
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to update status");
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const startEditFaltante = (f: ProductoFaltante) => {
    setEditingFaltanteId(f.id);
    setNewFaltante({
      productoId: f.productoId || "",
      productoDescripcion: f.productoDescripcion,
      cantidad: f.cantidad,
      comentario: f.comentario || "",
      clienteId: f.clienteId || "",
      clienteName: f.clienteName || "",
    });
    setProductoSearch("");
    setFaltanteClientSearch("");
    setIsFaltanteOpen(true);
  };

  const resetFaltanteForm = () => {
    setEditingFaltanteId(null);
    setNewFaltante({ productoId: "", productoDescripcion: "", cantidad: 0, comentario: "", clienteId: "", clienteName: "" });
    setProductoSearch("");
    setFaltanteClientSearch("");
  };

  const handleSubmitFaltante = async () => {
    if (!currentUser) return;
    if (!newFaltante.productoDescripcion.trim()) {
      toast.error("Selecciona un producto o escribe una descripción");
      return;
    }
    if (!newFaltante.cantidad || newFaltante.cantidad <= 0) {
      toast.error("Captura una cantidad válida");
      return;
    }
    const isEdit = !!editingFaltanteId;
    try {
      const res = await fetch(
        isEdit ? `/api/productos-faltantes/${editingFaltanteId}` : "/api/productos-faltantes",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  productoId: newFaltante.productoId || null,
                  productoDescripcion: newFaltante.productoDescripcion,
                  cantidad: newFaltante.cantidad,
                  comentario: newFaltante.comentario,
                  clienteId: newFaltante.clienteId || null,
                }
              : {
                  userId: currentUser.id,
                  productoId: newFaltante.productoId || undefined,
                  productoDescripcion: newFaltante.productoDescripcion,
                  cantidad: newFaltante.cantidad,
                  comentario: newFaltante.comentario,
                  clienteId: newFaltante.clienteId || undefined,
                }
          ),
        }
      );
      if (res.ok) {
        toast.success(isEdit ? "Faltante actualizado" : "Faltante registrado");
        setIsFaltanteOpen(false);
        resetFaltanteForm();
        const r = await fetch("/api/productos-faltantes");
        if (r.ok) setFaltantes(await r.json());
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || (isEdit ? "Error al actualizar faltante" : "Error al registrar faltante"));
      }
    } catch {
      toast.error(isEdit ? "Error al actualizar faltante" : "Error al registrar faltante");
    }
  };

  const handleCreateFaltante = handleSubmitFaltante;

  const toggleFaltanteEstado = async (f: ProductoFaltante) => {
    const next = f.estado === "pendiente" ? "resuelto" : "pendiente";
    try {
      const res = await fetch(`/api/productos-faltantes/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: next }),
      });
      if (res.ok) {
        const r = await fetch("/api/productos-faltantes");
        if (r.ok) setFaltantes(await r.json());
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al actualizar");
      }
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const openStatusUpdate = (lead: Lead, newStatus?: LeadStatus) => {
    setSelectedLead(lead);
    setStatusUpdate({
      status: newStatus || lead.status,
      comment: "",
      evidenceUrl: "",
      quotedAmount: lead.quotedAmount || 0,
      invoicedAmount: lead.invoicedAmount || 0,
      rechazoMotivoId: 0,
      erpClientId: "",
    });
    setErpClientSearch("");
    setIsStatusUpdateOpen(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Check if dropped over a column (status) or a card in a column
    const statuses: LeadStatus[] = ["ASIGNADO", "CONTACTADO", "NEGOCIACION", "COTIZADO", "FACTURADO", "ENTREGADO", "RECHAZADO"];
    let newStatus: LeadStatus | null = null;

    if (statuses.includes(overId as LeadStatus)) {
      newStatus = overId as LeadStatus;
    } else {
      // Dropped over a card, find that card's status
      const overLead = leads.find(l => l.id === overId);
      if (overLead) {
        newStatus = overLead.status;
      }
    }

    if (newStatus) {
      const lead = leads.find(l => l.id === leadId);
      if (lead && lead.status !== newStatus) {
        openStatusUpdate(lead, newStatus);
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleCreateLead = async () => {
    if (!newLead.company.trim()) {
      toast.error("Selecciona o escribe una empresa");
      return;
    }
    if (currentUser?.role === "Admin" && !newLead.assignedTo) {
      toast.error("Asigna el lead a un vendedor");
      return;
    }
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newLead,
          userId: currentUser?.role === "Seller" ? currentUser.id : newLead.assignedTo
        })
      });
      if (res.ok) {
        toast.success(currentUser?.role === "Seller" ? "Lead creado y asignado a ti" : "Nuevo lead creado");
        setIsNewLeadOpen(false);
        setNewLead({
          name: "",
          email: "",
          company: "",
          value: 0,
          sucursal: (currentUser?.role === "Seller" ? sucursales.find(s => s.id === currentUser.sucursalId)?.name : "") || (sucursales.length > 0 ? sucursales[0].name : ""),
          segmento: segmentos.length > 0 ? segmentos[0].name : "",
          isExistingClient: false,
          clientId: "",
          assignedTo: "",
          clientInitiated: false,
          mostrador: false,
        });
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al crear lead");
      }
    } catch (error) {
      toast.error("Error al crear lead");
    }
  };

  const fetchGoalsTimeline = async (userId: string, setter: (g: SalesGoal[]) => void) => {
    setGoalsLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/goals`);
      if (res.ok) setter(await res.json());
    } finally {
      setGoalsLoading(false);
    }
  };

  const handleOpenUserDetail = (user: User) => {
    setSelectedUserDetail(user);
    setUserDetailEmail(user.email);
    setUserDetailPassword("");
    setUserDetailSucursal(user.sucursalId);
    fetchGoalsTimeline(user.id, setUserGoalsTimeline);
  };

  const handleUpdateUserEmail = async () => {
    if (!selectedUserDetail) return;
    try {
      const res = await fetch(`/api/users/${selectedUserDetail.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userDetailEmail })
      });
      if (res.ok) {
        toast.success("Correo actualizado");
        fetchData();
        setSelectedUserDetail(prev => prev ? { ...prev, email: userDetailEmail } : null);
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar correo");
      }
    } catch {
      toast.error("Error al actualizar correo");
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUserDetail || !userDetailPassword) return;
    try {
      const res = await fetch(`/api/users/${selectedUserDetail.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: userDetailPassword })
      });
      if (res.ok) {
        toast.success("Contraseña actualizada");
        setUserDetailPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al actualizar contraseña");
      }
    } catch {
      toast.error("Error al actualizar contraseña");
    }
  };

  const handleUpdateRole = async (userId: string, role: "Admin" | "Seller") => {
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role })
      });
      if (res.ok) {
        toast.success("Rol de usuario actualizado");
        fetchData();
      }
    } catch (error) {
      toast.error("Error al actualizar rol");
    }
  };

  const handleUpdateGoal = async (userId: string, goal: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal })
      });
      if (res.ok) {
        toast.success("Meta de ventas actualizada");
        fetchData();
      }
    } catch (error) {
      toast.error("Error al actualizar meta");
    }
  };

  const handleSetBranchGoal = async () => {
    if (!branchGoal.sucursalId || !branchGoal.amount) return;
    try {
      const res = await fetch(`/api/sucursales/${branchGoal.sucursalId}/goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: branchGoal.amount, year: branchGoal.year, month: branchGoal.month })
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Meta aplicada a ${data.updated} vendedor(es)`);
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Error al establecer meta");
      }
    } catch {
      toast.error("Error al establecer meta");
    }
  };

  const handleCreateUser = async () => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        toast.success("Nuevo usuario creado exitosamente");
        setIsNewUserOpen(false);
        setNewUser({ name: "", email: "", role: "Seller", salesGoal: 50000, sucursal: "" });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error al crear usuario");
      }
    } catch (error) {
      toast.error("Error al crear usuario");
    }
  };

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case "ASIGNADO": return <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">Asignado</Badge>;
      case "CONTACTADO": return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Contactado</Badge>;
      case "NEGOCIACION": return <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100">Negociación</Badge>;
      case "COTIZADO": return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">Cotizado</Badge>;
      case "FACTURADO": return <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">Facturado</Badge>;
      case "ENTREGADO": return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Entregado</Badge>;
      case "RECHAZADO": return <Badge variant="destructive">Rechazado</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-brand-navy">
        <div className="absolute top-0 inset-x-0 h-1 bg-brand-red" />
        <Toaster position="top-right" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-white overflow-hidden pt-0">
            <div className="h-2 bg-white" />
            <CardHeader className="text-center space-y-2 pt-8">
              <img src="https://ecosistemas.com.mx/cdn/shop/files/logoeco.png?v=1758568786&width=260" alt="Ecosistemas" className="h-14 object-contain mx-auto mb-2" />
              <p className="text-sm font-semibold text-brand-navy">Panel de ventas</p>
              <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-brand-navy ml-1">Correo Electrónico</label>
                    <Input
                      type="email"
                      placeholder="nombre@empresa.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-brand-navy ml-1">Contraseña</label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 gap-2 text-base font-semibold">
                  <LogIn className="w-5 h-5" />
                  Iniciar sesión
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-white/70 mt-4">Ecosistemas · Soluciones Innovadoras</p>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-brand-red/20" />
          <p className="text-brand-navy font-medium">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full bg-white border-b-2 border-brand-red">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://ecosistemas.com.mx/cdn/shop/files/logoeco.png?v=1758568786&width=260" alt="Ecosistemas" className="h-8 object-contain" />
            <span className="hidden sm:inline-block h-6 w-px bg-slate-200" />
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-brand-navy">CRM</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold text-brand-navy">{currentUser.name}</span>
              <span className="text-xs text-brand-gray">{currentUser.role}</span>
            </div>
            <Popover>
              <PopoverTrigger nativeButton={false} render={
                <div className="relative w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center border border-slate-200 cursor-pointer hover:bg-slate-300 transition-colors">
                  <Bell className="w-5 h-5 text-slate-600" />
                  {notifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                      {notifications.length}
                    </span>
                  )}
                </div>
              } />
              <PopoverContent align="end" className="w-80 p-0">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <span className="font-semibold text-sm">Alertas</span>
                  <Badge variant="secondary" className="text-xs">{notifications.length}</Badge>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      Sin alertas pendientes
                    </div>
                  ) : (
                    notifications.map(n => (
                      <button
                        key={n.id}
                        onClick={() => openStatusUpdate(n.lead)}
                        className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className={cn("w-4 h-4 mt-0.5 flex-shrink-0", n.kind === "stale-quote" ? "text-red-500" : "text-amber-500")} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{n.lead.name}</p>
                            <p className="text-xs text-slate-500 truncate">{n.lead.company}</p>
                            <p className="text-xs mt-1" style={{color: "#141456"}}>
                              {n.kind === "stale-quote"
                                ? `Cotización sin actualizar hace ${n.days} días`
                                : `Lead asignado sin actualizar hace ${n.days} días`}
                            </p>
                            {currentUser.role === "Admin" && (
                              <p className="text-[10px] text-slate-400 mt-0.5">Vendedor: {n.sellerName}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Dialog>
              <DialogTrigger nativeButton={false} render={
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center border border-slate-200 cursor-pointer hover:bg-slate-300 transition-colors">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
              } />
              <DialogContent className="sm:max-w-[300px]">
                <DialogHeader>
                  <DialogTitle>Cuenta</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                      {currentUser.name.charAt(0)}
                    </div>
                    <div className="text-center">
                      <p className="font-bold">{currentUser.name}</p>
                      <p className="text-xs text-slate-500">{currentUser.email}</p>
                    </div>
                  </div>
                  <Button variant="destructive" className="w-full gap-2" onClick={handleLogout}>
                    <LogOut className="w-4 h-4" />
                    Cerrar Sesión
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <Tabs defaultValue={currentUser.role === "Admin" ? "admin" : "my-leads"} className="space-y-6 md:space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList variant="line" className="h-12 w-full md:w-auto overflow-x-auto border-b">
              <TabsTrigger value="my-leads" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                <UserCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Mis Leads</span>
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                <Kanban className="w-4 h-4" />
                <span className="hidden sm:inline">Pipeline</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">Rendimiento</span>
              </TabsTrigger>
              <TabsTrigger value="faltantes" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Faltantes</span>
              </TabsTrigger>
              {currentUser.role === "Admin" && (
                <TabsTrigger value="admin" className="gap-1.5 px-3 md:px-6 flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">Panel Admin</span>
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex items-center gap-2">
              <Dialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen}>
                <DialogTrigger nativeButton={true} render={<Button className="gap-2" />}>
                  <Plus className="w-4 h-4" />
                  Nuevo Lead
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Lead</DialogTitle>
                    <DialogDescription>
                      Registra un nuevo lead en el sistema. Puedes crear un cliente nuevo o seleccionar uno existente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Empresa</label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="TechCorp" 
                          value={newLead.company}
                          onChange={(e) => setNewLead({
                            ...newLead, 
                            company: e.target.value,
                            isExistingClient: false,
                            clientId: ""
                          })}
                          className="flex-1"
                        />
                        <Popover open={isClientSearchOpen} onOpenChange={setIsClientSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0">
                              <Search className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[300px]" align="end">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Buscar por nombre comercial, razón social, contacto, email, RFC o ID..."
                                value={clientSearch}
                                onValueChange={setClientSearch}
                              />
                              <CommandList>
                                {(() => {
                                  const rawQ = clientSearch.trim().toLowerCase();
                                  if (!rawQ) {
                                    return (
                                      <div className="py-6 text-center text-xs text-slate-500">
                                        Escribe para buscar entre {clients.length.toLocaleString()} clientes
                                      </div>
                                    );
                                  }
                                  // Whitespace-insensitive so "control de plagas" matches "controldeplagas"
                                  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
                                  const q = squash(rawQ);
                                  const MAX = 50;
                                  const matches: Client[] = [];
                                  // Sellers can only pick existing clients from their own sucursal
                                  const norm = (v?: string) => /^\d+$/.test(v || "") ? String(parseInt(v!, 10)) : (v || "").trim();
                                  const sellerSucursalId = currentUser?.role === "Seller" ? norm(currentUser.sucursalId) : null;
                                  for (const c of clients) {
                                    if (sellerSucursalId && norm(c.sucursalId) !== sellerSucursalId) continue;
                                    const stripped = c.id.replace(/^0+/, '');
                                    if (
                                      squash(c.company).includes(q) ||
                                      squash(c.tradeName || '').includes(q) ||
                                      squash(c.name).includes(q) ||
                                      squash(c.email || '').includes(q) ||
                                      squash(c.rfc || '').includes(q) ||
                                      c.id.includes(rawQ) ||
                                      stripped.includes(rawQ)
                                    ) {
                                      matches.push(c);
                                      if (matches.length >= MAX) break;
                                    }
                                  }
                                  if (matches.length === 0) {
                                    return <CommandEmpty>No se encontraron clientes.</CommandEmpty>;
                                  }
                                  return matches.map((client: Client) => (
                                    <CommandItem
                                      key={client.id}
                                      value={client.id}
                                      onSelect={() => {
                                        setNewLead({
                                          ...newLead,
                                          isExistingClient: true,
                                          clientId: client.id,
                                          name: client.name,
                                          company: client.company,
                                          email: client.email,
                                          sucursal: sucursales.find(s => s.id === client.sucursalId)?.name || newLead.sucursal,
                                          segmento: client.segmento || newLead.segmento,
                                        });
                                        setClientSearch("");
                                        setIsClientSearchOpen(false);
                                      }}
                                    >
                                      <div className="flex flex-col gap-0.5">
                                        <span className="font-medium">{client.tradeName || client.company}</span>
                                        {client.tradeName && client.company && (
                                          <span className="text-xs text-slate-500">{client.company}</span>
                                        )}
                                        {client.name && <span className="text-xs text-slate-500">{client.name}</span>}
                                        {client.rfc && <span className="text-[10px] text-slate-400">{client.rfc}</span>}
                                      </div>
                                    </CommandItem>
                                  ));
                                })()}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Valor Potencial ($)</label>
                      <Input
                        type="number"
                        placeholder="5000"
                        value={newLead.value || ""}
                        onChange={(e) => setNewLead({...newLead, value: Number(e.target.value)})}
                      />
                    </div>

                    <label className="flex items-center gap-2 p-3 rounded-md bg-slate-50 border cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={newLead.clientInitiated}
                        onChange={(e) => setNewLead({ ...newLead, clientInitiated: e.target.checked })}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Cliente me contactó</span>
                        <span className="text-[11px] text-slate-500">Marcar si fue el cliente quien inició el contacto.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 p-3 rounded-md bg-slate-50 border cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={newLead.mostrador}
                        onChange={(e) => setNewLead({ ...newLead, mostrador: e.target.checked })}
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">Mostrador</span>
                        <span className="text-[11px] text-slate-500">Marcar si el lead empezó como una consulta de mostrador (cliente caminó a sucursal).</span>
                      </div>
                    </label>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Segmento</label>
                      <Select value={newLead.segmento} onValueChange={(val) => setNewLead({...newLead, segmento: val})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar Segmento" />
                        </SelectTrigger>
                        <SelectContent>
                          {segmentos.map(s => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {currentUser?.role === "Admin" && (
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Asignar a</label>
                        <Popover open={isSellerSearchOpen} onOpenChange={setIsSellerSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-between font-normal">
                              {newLead.assignedTo
                                ? users.find(u => u.id === newLead.assignedTo)?.name || "Seleccionar vendedor"
                                : "Seleccionar vendedor"}
                              <Search className="w-4 h-4 ml-2 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[300px]" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar vendedor..." />
                              <CommandList>
                                <CommandEmpty>No se encontraron vendedores.</CommandEmpty>
                                <CommandGroup heading="Vendedores">
                                  {users
                                    .filter(u => u.role === "Seller")
                                    .filter(u => {
                                      const clientSucursalId = newLead.isExistingClient
                                        ? clients.find(c => c.id === newLead.clientId)?.sucursalId
                                        : null;
                                      if (!clientSucursalId) return true;
                                      // Normalize to ignore zero-padding mismatches ("0020" vs "20")
                                      const norm = (v?: string) => /^\d+$/.test(v || "") ? String(parseInt(v!, 10)) : (v || "").trim();
                                      return norm(u.sucursalId) === norm(clientSucursalId);
                                    })
                                    .map(u => (
                                      <CommandItem
                                        key={u.id}
                                        value={`${u.name} ${sucursales.find(s => s.id === u.sucursalId)?.name || ""}`}
                                        onSelect={() => {
                                          setNewLead({...newLead, assignedTo: u.id});
                                          setIsSellerSearchOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">{u.name}</span>
                                          <span className="text-xs text-slate-500">{sucursales.find(s => s.id === u.sucursalId)?.name || ""}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNewLeadOpen(false)}>Cancelar</Button>
                    <Button onClick={handleCreateLead}>Crear Lead</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>


          <TabsContent value="my-leads" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Mis Leads Activos</h2>
                <p className="text-slate-500">Gestiona y actualiza el estado de los leads asignados a ti.</p>
              </div>
              <div className="w-full md:w-72">
                <div className="relative">
                  <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Buscar cliente o empresa..." 
                    className="pl-9 h-10 bg-white"
                    value={myLeadsSearch}
                    onChange={(e) => setMyLeadsSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {leads.filter(l => {
                const isAssigned = l.assignedTo === currentUser.id;
                const matchesSearch = !myLeadsSearch || 
                  l.name.toLowerCase().includes(myLeadsSearch.toLowerCase()) || 
                  l.company.toLowerCase().includes(myLeadsSearch.toLowerCase());
                return isAssigned && matchesSearch;
              }).length === 0 ? (
                <Card className="border-dashed border-2 bg-transparent">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                    <p>{myLeadsSearch ? "No se encontraron leads que coincidan con la búsqueda." : "Aún no tienes leads asignados."}</p>
                  </CardContent>
                </Card>
              ) : (
                leads.filter(l => {
                  const isAssigned = l.assignedTo === currentUser.id;
                  const matchesSearch = !myLeadsSearch || 
                    l.name.toLowerCase().includes(myLeadsSearch.toLowerCase()) || 
                    l.company.toLowerCase().includes(myLeadsSearch.toLowerCase());
                  return isAssigned && matchesSearch;
                }).map((lead) => (
                  <Card key={lead.id} className="bg-white overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
                        <div className="flex items-start gap-4">
                          <div className="bg-slate-100 p-3 rounded-full">
                            <Users className="w-6 h-6 text-slate-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-bold text-lg">{lead.name}</h3>
                              {getStatusBadge(lead.status)}
                              {lead.mostrador && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] uppercase tracking-wide">Mostrador</Badge>
                              )}
                            </div>
                            <p className="text-slate-500 text-sm">{lead.company} • {lead.email}</p>
                            <p className="text-primary font-mono font-bold mt-2">${lead.value.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <div className="w-full sm:w-auto">
                            <p className="text-sm font-semibold text-brand-navy mb-1.5 ml-1">Actualizar estado</p>
                            <Select 
                              value={lead.status} 
                              onValueChange={(val) => openStatusUpdate(lead, val as LeadStatus)}
                            >
                              <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Cambiar estado" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ASIGNADO">Asignado</SelectItem>
                                <SelectItem value="CONTACTADO">Contactado</SelectItem>
                                <SelectItem value="NEGOCIACION">Negociación</SelectItem>
                                <SelectItem value="COTIZADO">Cotizado</SelectItem>
                                <SelectItem value="FACTURADO">Facturado</SelectItem>
                                <SelectItem value="ENTREGADO">Entregado</SelectItem>
                                <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button 
                            variant="outline" 
                            className="w-full sm:w-auto mt-auto gap-2"
                            onClick={() => openStatusUpdate(lead)}
                          >
                            <History className="w-4 h-4" /> Historial
                          </Button>
                        </div>
                      </div>
                      <div className="bg-slate-50 px-6 py-3 flex items-center justify-between border-t">
                        <span className="text-xs text-slate-400">Última actualización: {new Date(lead.updatedAt).toLocaleDateString()}</span>
                        <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>Activo por {Math.floor((new Date().getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))} días</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="kanban" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Pipeline de Ventas</h2>
                <p className="text-slate-500">Visión general de todos los leads activos en el pipeline.</p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="relative w-full md:w-64 space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Buscar Leads</p>
                  <div className="relative">
                    <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Buscar leads..." 
                      className="pl-9 h-9"
                      value={kanbanSearch}
                      onChange={(e) => setKanbanSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Sucursal</p>
                  <Select value={kanbanFilterSucursal} onValueChange={setKanbanFilterSucursal}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Todas las Sucursales" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las Sucursales</SelectItem>
                      {sucursales.map(s => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Segmento</p>
                  <Select value={kanbanFilterSegmento} onValueChange={setKanbanFilterSegmento}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="Todos los Segmentos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los Segmentos</SelectItem>
                      {segmentos.map(s => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Mes</p>
                  <Select value={kanbanFilterMonth} onValueChange={setKanbanFilterMonth}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Mes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los meses</SelectItem>
                      {kanbanMonthOptions.map(ym => {
                        const [y, m] = ym.split("-").map(Number);
                        return <SelectItem key={ym} value={ym}>{`${MESES[m - 1]} ${y}`}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {currentUser.role === "Admin" && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-brand-gray ml-1">Vendedor</p>
                    <Select value={kanbanFilterSeller} onValueChange={setKanbanFilterSeller}>
                      <SelectTrigger className="w-[150px] h-9">
                        <SelectValue placeholder="Todos los Vendedores" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los Vendedores</SelectItem>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {users
                          .filter(u => kanbanFilterSucursal === "all" || u.sucursalId === sucursales.find(s => s.name === kanbanFilterSucursal)?.id)
                          .map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 min-h-[600px] -mx-2 px-2 md:mx-0 md:px-0">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                {(["ASIGNADO", "CONTACTADO", "NEGOCIACION", "COTIZADO", "FACTURADO", "ENTREGADO", "RECHAZADO"] as LeadStatus[])
                  .map((status) => (
                  <KanbanColumn 
                    key={status}
                    status={status}
                    leads={leads.filter(l => {
                      // Role-based visibility
                      if (currentUser.role === "Seller") {
                        if (l.assignedTo !== currentUser.id) return false;
                      } else if (currentUser.role === "Admin") {
                        // Admin filters
                        if (kanbanFilterSeller !== "all") {
                          if (kanbanFilterSeller === "unassigned") {
                            if (l.assignedTo) return false;
                          } else if (l.assignedTo !== kanbanFilterSeller) {
                            return false;
                          }
                        }
                      }

                      // Search filter
                      if (kanbanSearch && !l.name.toLowerCase().includes(kanbanSearch.toLowerCase()) && !l.company.toLowerCase().includes(kanbanSearch.toLowerCase())) {
                        return false;
                      }

                      // Sucursal filter
                      if (kanbanFilterSucursal !== "all" && l.sucursal !== kanbanFilterSucursal) {
                        return false;
                      }

                      // Segmento filter
                      if (kanbanFilterSegmento !== "all" && l.segmento !== kanbanFilterSegmento) {
                        return false;
                      }

                      // Month filter — only applies to closed leads (ENTREGADO / RECHAZADO).
                      // Active leads always show so sellers keep them in sight until closed.
                      if (kanbanFilterMonth !== "all" && (l.status === "ENTREGADO" || l.status === "RECHAZADO")) {
                        const d = new Date(l.updatedAt);
                        if (isNaN(d.getTime())) return false;
                        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                        if (ym !== kanbanFilterMonth) return false;
                      }

                      return true;
                    })}
                    users={users}
                    onUpdate={openStatusUpdate}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
                <DragOverlay>
                  {activeId ? (
                    <div className="bg-white p-4 rounded-lg border-2 border-primary w-80 opacity-90">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm text-primary">{leads.find(l => l.id === activeId)?.name}</h4>
                        <span className="text-[10px] font-mono font-bold text-slate-400">${leads.find(l => l.id === activeId)?.value.toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-500">{leads.find(l => l.id === activeId)?.company}</p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Análisis de Rendimiento</h2>
                <p className="text-slate-500">
                  {currentUser.role === "Admin" 
                    ? "Rendimiento de ventas de todo el equipo y salud del pipeline." 
                    : "Tus métricas de ventas personales y progreso del pipeline."}
                </p>
              </div>

              {currentUser.role === "Admin" && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-brand-gray ml-1">Filtrar por Vendedor</p>
                  <Select value={perfUserFilter} onValueChange={setPerfUserFilter}>
                    <SelectTrigger className="w-[200px] h-10">
                      <SelectValue placeholder="Seleccionar Vista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Resumen del Equipo</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {currentUser.role === "Admin" && perfUserFilter === "all" ? (
              <Card className="bg-white overflow-hidden">
                <CardHeader>
                  <CardTitle>Resumen de Rendimiento del Equipo</CardTitle>
                  <CardDescription>Resumen de todos los vendedores y su estado actual del pipeline.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="font-semibold">Vendedor</TableHead>
                        <TableHead className="font-semibold">Vendido ($)</TableHead>
                        <TableHead className="font-semibold">Cotizado ($)</TableHead>
                        <TableHead className="font-semibold">Perdido ($)</TableHead>
                        <TableHead className="font-semibold">Origen</TableHead>
                        <TableHead className="font-semibold">Nuevos Clientes</TableHead>
                        <TableHead className="font-semibold">1er Contacto</TableHead>
                        <TableHead className="font-semibold">COT→FACT</TableHead>
                        <TableHead className="font-semibold">Progreso Meta</TableHead>
                        <TableHead className="text-right font-semibold">Conversión</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        const userLeads = leads.filter(l => l.assignedTo === user.id);
                        const soldValue = userLeads.filter(l => l.status === "FACTURADO" || l.status === "ENTREGADO").reduce((acc, l) => acc + (l.invoicedAmount ?? l.value), 0);
                        const quotedValue = userLeads.filter(l => l.status === "COTIZADO").reduce((acc, l) => acc + (l.quotedAmount ?? l.value), 0);
                        const lostValue = userLeads.filter(l => l.status === "RECHAZADO").reduce((acc, l) => acc + l.value, 0);
                        const clientInitiated = userLeads.filter(l => l.clientInitiated).length;
                        const sellerInitiated = userLeads.length - clientInitiated;
                        const newClientCounts = newClientsByMonth(userLeads);
                        const newClientsThisMonth = newClientCounts.get(currentYearMonth()) || 0;
                        const newClientsTotal = [...newClientCounts.values()].reduce((a, b) => a + b, 0);
                        const ttfc = timeToFirstContact(userLeads);
                        const userFunnel = funnelByStage(userLeads);
                        const cotToFact = userFunnel.find(s => s.stage === "FACTURADO")?.stepConversion ?? null;
                        const progress = Math.min(100, Math.round((soldValue / user.performance.salesGoal) * 100));

                        return (
                          <TableRow key={user.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setPerfUserFilter(user.id)}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                  {user.name.charAt(0)}
                                </div>
                                {user.name}
                              </div>
                            </TableCell>
                            <TableCell className="font-bold text-green-600">${soldValue.toLocaleString()}</TableCell>
                            <TableCell className="text-amber-600">${quotedValue.toLocaleString()}</TableCell>
                            <TableCell className="text-red-600">${lostValue.toLocaleString()}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 leading-tight">
                                <span className="text-[11px] text-blue-600">Cliente: <span className="font-bold">{clientInitiated}</span></span>
                                <span className="text-[11px] text-slate-600">Vendedor: <span className="font-bold">{sellerInitiated}</span></span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5 leading-tight">
                                <span className="text-sm font-bold text-emerald-700">{newClientsThisMonth}</span>
                                <span className="text-[10px] text-slate-500">este mes · {newClientsTotal} total</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {ttfc.median !== null ? (
                                <div className="flex flex-col gap-0.5 leading-tight">
                                  <span className="text-sm font-bold text-slate-900">{formatDays(ttfc.median)}</span>
                                  <span className="text-[10px] text-slate-500">mediana · n={ttfc.count}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">sin datos</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {cotToFact !== null ? (
                                <span className="text-xs font-bold text-slate-900">{cotToFact.toFixed(0)}%</span>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden border">
                                  <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                                </div>
                                <span className="text-xs font-bold">{progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{(user.performance.conversionRate * 100).toFixed(1)}%</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {(currentUser.role === "Admin" 
                  ? users.filter(u => u.id === perfUserFilter) 
                  : users.filter(u => u.id === currentUser.id)
                ).map((user) => {
                  const userLeads = leads.filter(l => l.assignedTo === user.id);
                  const soldValue = userLeads.filter(l => l.status === "FACTURADO" || l.status === "ENTREGADO").reduce((acc, l) => acc + (l.invoicedAmount ?? l.value), 0);
                  const quotedValue = userLeads.filter(l => l.status === "COTIZADO").reduce((acc, l) => acc + (l.quotedAmount ?? l.value), 0);
                  const lostValue = userLeads.filter(l => l.status === "RECHAZADO").reduce((acc, l) => acc + l.value, 0);
                  
                  const soldCount = userLeads.filter(l => l.status === "FACTURADO" || l.status === "ENTREGADO").length;
                  const quotedCount = userLeads.filter(l => l.status === "COTIZADO").length;
                  const lostCount = userLeads.filter(l => l.status === "RECHAZADO").length;

                  const pieData = [
                    { name: 'Vendido', value: soldValue, color: '#10b981' },
                    { name: 'Cotizado', value: quotedValue, color: '#f59e0b' },
                    { name: 'Perdido', value: lostValue, color: '#ef4444' },
                  ].filter(d => d.value > 0);

                  const lostLeads = userLeads.filter(l => l.status === "RECHAZADO");

                  const clientInitiatedCount = userLeads.filter(l => l.clientInitiated).length;
                  const sellerInitiatedCount = userLeads.length - clientInitiatedCount;
                  const clientInitiatedPct = userLeads.length > 0
                    ? Math.round((clientInitiatedCount / userLeads.length) * 100)
                    : 0;

                  const userFaltantes = faltantes.filter(f => f.vendedorId === user.id);
                  const faltantesThisMonth = userFaltantes.filter(f => {
                    const d = new Date(f.createdAt);
                    return !isNaN(d.getTime()) && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === currentYearMonth();
                  }).length;
                  const faltantesPendientes = userFaltantes.filter(f => f.estado === "pendiente").length;

                  const newClientCounts = newClientsByMonth(userLeads);
                  const recentMonthsForUser = (() => {
                    const out: { ym: string; label: string; count: number }[] = [];
                    const now = new Date();
                    for (let i = 5; i >= 0; i--) {
                      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                      out.push({
                        ym,
                        label: `${MESES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`,
                        count: newClientCounts.get(ym) || 0,
                      });
                    }
                    return out;
                  })();
                  const newClientsThisMonth = newClientCounts.get(currentYearMonth()) || 0;
                  const newClientsTotal = [...newClientCounts.values()].reduce((a, b) => a + b, 0);
                  const maxBar = Math.max(1, ...recentMonthsForUser.map(m => m.count));

                  const userTtfc = timeToFirstContact(userLeads);
                  const userFunnelData = funnelByStage(userLeads);
                  const userPareto = rechazoMotivosPareto(userLeads);
                  const totalLost = userPareto.reduce((s, m) => s + m.lostValue, 0);
                  const stageColor: Record<string, string> = {
                    ASIGNADO: "bg-slate-400",
                    CONTACTADO: "bg-blue-500",
                    NEGOCIACION: "bg-purple-500",
                    COTIZADO: "bg-orange-500",
                    FACTURADO: "bg-indigo-500",
                    ENTREGADO: "bg-emerald-500",
                  };

                  return (
                    <div key={user.id} className="lg:col-span-3 space-y-6">
                      {/* Summary Scorecard */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="bg-white">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                              <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-brand-gray">Total Vendido</p>
                              <p className="text-xl font-bold text-green-600">${soldValue.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">{soldCount} tratos cerrados</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-white">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-brand-gray">Total Cotizado</p>
                              <p className="text-xl font-bold text-amber-600">${quotedValue.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">{quotedCount} cotizaciones activas</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-white">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                              <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-brand-gray">Total Perdido</p>
                              <p className="text-xl font-bold text-red-600">${lostValue.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">{lostCount} tratos perdidos</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="bg-white">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                              <TrendingUp className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-brand-gray">Meta de Ventas</p>
                              <p className="text-xl font-bold text-slate-900">${user.performance.salesGoal.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">{Math.min(100, Math.round((soldValue / user.performance.salesGoal) * 100))}% alcanzado</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="bg-white overflow-hidden lg:col-span-1">
                          <div className="h-2 bg-primary w-full opacity-20" />
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border">
                                  <UserCheck className="w-5 h-5 text-slate-600" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">{user.name}</CardTitle>
                                  <CardDescription>{user.role === "Admin" ? "Administrador" : "Vendedor"}</CardDescription>
                                </div>
                              </div>
                              {soldValue >= user.performance.salesGoal && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Meta Cumplida</Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-6">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500 font-medium">Progreso de Meta</span>
                                <span className="font-bold">{Math.min(100, Math.round((soldValue / user.performance.salesGoal) * 100))}%</span>
                              </div>
                              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (soldValue / user.performance.salesGoal) * 100)}%` }}
                                  className={cn(
                                    "h-full transition-all",
                                    soldValue >= user.performance.salesGoal ? "bg-green-500" : "bg-primary"
                                  )}
                                />
                              </div>
                            </div>

                            <div className="pt-4 border-t space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Tasa de Conversión</span>
                                <span className="text-sm font-bold">{(user.performance.conversionRate * 100).toFixed(1)}%</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500">Leads Activos</span>
                                <span className="text-sm font-bold">{user.workload?.activeLeads || 0}</span>
                              </div>
                            </div>

                            <div className="pt-4 border-t space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-brand-navy">Origen del Contacto</span>
                                <span className="text-[10px] text-slate-400">{userLeads.length} total</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-2">
                                  <p className="text-xs font-semibold text-blue-700">Cliente</p>
                                  <p className="text-lg font-bold text-blue-700 leading-tight">{clientInitiatedCount}</p>
                                  <p className="text-[10px] text-blue-600/70">{clientInitiatedPct}% del total</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  <p className="text-xs font-semibold text-brand-gray">Vendedor</p>
                                  <p className="text-lg font-bold text-slate-700 leading-tight">{sellerInitiatedCount}</p>
                                  <p className="text-[10px] text-slate-500">{100 - clientInitiatedPct}% del total</p>
                                </div>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                <div className="h-full bg-blue-500" style={{ width: `${clientInitiatedPct}%` }} />
                                <div className="h-full bg-slate-400" style={{ width: `${100 - clientInitiatedPct}%` }} />
                              </div>
                            </div>

                            <div className="pt-4 border-t space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-brand-navy">Faltantes</span>
                                <span className="text-[10px] text-slate-400">{userFaltantes.length} total</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2">
                                  <p className="text-xs font-semibold text-amber-700">Este mes</p>
                                  <p className="text-lg font-bold text-amber-700 leading-tight">{faltantesThisMonth}</p>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  <p className="text-xs font-semibold text-brand-gray">Pendientes</p>
                                  <p className="text-lg font-bold text-slate-700 leading-tight">{faltantesPendientes}</p>
                                </div>
                              </div>
                            </div>

                            <div className="pt-4 border-t space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-brand-navy">Nuevos Clientes</span>
                                <span className="text-[10px] text-slate-400">{newClientsTotal} total</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-emerald-600 leading-none">{newClientsThisMonth}</span>
                                <span className="text-[10px] text-slate-500">este mes</span>
                              </div>
                              <div className="flex items-end gap-1 h-12 pt-1">
                                {recentMonthsForUser.map(m => {
                                  const isCurrent = m.ym === currentYearMonth();
                                  const heightPct = (m.count / maxBar) * 100;
                                  return (
                                    <div key={m.ym} className="flex-1 flex flex-col items-center gap-0.5">
                                      <span className="text-[9px] font-semibold text-slate-600">{m.count || ""}</span>
                                      <div className="w-full bg-slate-100 rounded-t flex items-end" style={{ height: "100%" }}>
                                        <div
                                          className={`w-full rounded-t ${isCurrent ? "bg-emerald-500" : "bg-emerald-300"}`}
                                          style={{ height: `${m.count === 0 ? 0 : Math.max(8, heightPct)}%` }}
                                        />
                                      </div>
                                      <span className="text-[9px] text-slate-400">{m.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>

                    <Card className="bg-white lg:col-span-1">
                      <CardHeader>
                        <CardTitle className="text-base font-bold text-brand-navy">Distribución de Pipeline ($)</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[250px]">
                        {pieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                formatter={(value: number) => `$${value.toLocaleString()}`}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              />
                              <Legend verticalAlign="bottom" height={36}/>
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                            <BarChart3 className="w-8 h-8 opacity-20" />
                            <p className="text-xs italic">No hay datos para visualizar</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="bg-white lg:col-span-1">
                      <CardHeader>
                        <CardTitle className="text-base font-bold text-brand-navy">Motivos de Rechazo</CardTitle>
                        <CardDescription className="text-[10px]">Últimos comentarios de tratos perdidos.</CardDescription>
                      </CardHeader>
                      <CardContent className="max-h-[250px] overflow-y-auto space-y-3">
                        {lostLeads.length > 0 ? (
                          lostLeads.map(lead => {
                            const lastRejection = lead.history.filter(h => h.status === "RECHAZADO").pop();
                            const motivo = lastRejection?.rechazoMotivo;
                            const comment = lastRejection?.comment;
                            return (
                              <div key={lead.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex justify-between items-start mb-1">
                                  <p className="text-xs font-bold text-slate-700">{lead.company}</p>
                                  <span className="text-[10px] font-mono text-slate-400">${lead.value.toLocaleString()}</span>
                                </div>
                                <p className="text-xs font-semibold text-red-700">
                                  {motivo || "Sin motivo registrado"}
                                </p>
                                {comment && (
                                  <p className="mt-1 text-[11px] font-light italic text-slate-500 leading-snug">
                                    {comment}
                                  </p>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 py-12">
                            <TrendingUp className="w-8 h-8 opacity-20" />
                            <p className="text-xs italic">Aún no hay tratos perdidos</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Embudo de Conversión */}
                    <Card className="bg-white lg:col-span-1">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-brand-navy">Embudo de Conversión</CardTitle>
                        <CardDescription className="text-[10px]">Leads que tocaron cada etapa, % vs ASIGNADO y conversión paso a paso</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {userFunnelData[0].count === 0 ? (
                          <p className="text-xs italic text-slate-400 text-center py-6">Sin leads.</p>
                        ) : (
                          userFunnelData.map((s) => (
                            <div key={s.stage} className="space-y-0.5">
                              <div className="flex items-baseline justify-between text-[11px]">
                                <span className="font-semibold text-slate-700">{s.stage}</span>
                                <div className="flex items-baseline gap-2">
                                  {s.stepConversion !== null && (
                                    <span className="text-[10px] text-slate-400">{s.stepConversion.toFixed(0)}% ↓</span>
                                  )}
                                  <span className="font-bold text-slate-900">{s.count}</span>
                                  <span className="text-[10px] text-slate-500">{s.pctOfTop.toFixed(0)}%</span>
                                </div>
                              </div>
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${stageColor[s.stage] || "bg-slate-400"}`} style={{ width: `${s.pctOfTop}%` }} />
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Tiempo a Primer Contacto */}
                    <Card className="bg-white lg:col-span-1">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-brand-navy">Tiempo a Primer Contacto</CardTitle>
                        <CardDescription className="text-[10px]">Tiempo entre asignación y primer CONTACTADO</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {userTtfc.median === null ? (
                          <p className="text-xs italic text-slate-400 text-center py-6">Aún no hay leads contactados.</p>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <p className="text-3xl font-bold text-slate-900 leading-none">{formatDays(userTtfc.median)}</p>
                              <p className="text-[10px] text-slate-500 mt-1">mediana sobre {userTtfc.count} leads</p>
                            </div>
                            <div className="text-[10px] text-slate-500 leading-relaxed">
                              Tiempo a primer contacto correlaciona fuertemente con la tasa de cierre. Por debajo de 1 día es ideal; arriba de 3 días la conversión cae rápido.
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Pareto de Motivos de Rechazo */}
                    <Card className="bg-white lg:col-span-1">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-brand-navy">Pareto de Motivos</CardTitle>
                        <CardDescription className="text-[10px]">
                          {totalLost > 0 ? `$${totalLost.toLocaleString()} en valor perdido` : "Sin valor perdido aún"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2 max-h-[250px] overflow-y-auto">
                        {userPareto.length === 0 ? (
                          <p className="text-xs italic text-slate-400 text-center py-6">Sin tratos rechazados.</p>
                        ) : (() => {
                          const max = userPareto[0].lostValue || 1;
                          return userPareto.map((m) => (
                            <div key={m.name} className="space-y-0.5">
                              <div className="flex items-baseline justify-between text-[11px]">
                                <span className="font-medium text-slate-700 truncate pr-2">{m.name}</span>
                                <div className="flex items-baseline gap-2 shrink-0">
                                  <span className="text-[10px] text-slate-500">×{m.count}</span>
                                  <span className="font-bold text-red-700">${m.lostValue.toLocaleString()}</span>
                                </div>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-red-400 rounded-full" style={{ width: `${(m.lostValue / max) * 100}%` }} />
                              </div>
                            </div>
                          ));
                        })()}
                      </CardContent>
                    </Card>

                    {/* Goals Timeline */}
                    <Card className="bg-white lg:col-span-3">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base font-bold text-brand-navy">Historial de Metas Mensuales</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {(() => {
                          const timeline = currentUser.role === "Admin"
                            ? userGoalsTimeline.filter(g => g.vendedorId === user.id)
                            : myGoalsTimeline;
                          const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                          if (timeline.length === 0) return (
                            <p className="text-xs text-slate-400 italic py-4 text-center">Sin metas registradas para este vendedor.</p>
                          );
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {timeline.map((g) => {
                                const pct = g.meta > 0 ? Math.min(100, Math.round((g.invoiced / g.meta) * 100)) : 0;
                                const badgeClass = g.status === "achieved" ? "bg-green-50 text-green-700 border-green-200"
                                  : g.status === "missed" ? "bg-red-50 text-red-700 border-red-200"
                                  : g.status === "current" ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-slate-50 text-slate-500 border-slate-200";
                                const badgeLabel = g.status === "achieved" ? "Cumplida" : g.status === "missed" ? "No cumplida" : g.status === "current" ? "En curso" : "Próxima";
                                return (
                                  <div key={g.id} className="rounded-lg border p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold">{MONTHS[g.month - 1]} {g.year}</span>
                                      <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>{badgeLabel}</Badge>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-500">
                                      <span>Meta: <span className="font-semibold text-slate-700">${g.meta.toLocaleString()}</span></span>
                                      <span>Facturado: <span className="font-semibold text-slate-700">${g.invoiced.toLocaleString()}</span></span>
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex justify-end text-[10px] font-bold">{pct}%</div>
                                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${g.status === "achieved" ? "bg-green-500" : g.status === "missed" ? "bg-red-400" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>

                  </div>
                </div>
              );
            })}
          </div>
          )}
        </TabsContent>

          <TabsContent value="faltantes" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Productos Faltantes</h2>
                <p className="text-slate-500">Registra ventas perdidas porque no había el producto que el cliente pedía.</p>
              </div>
              <Dialog open={isFaltanteOpen} onOpenChange={(open) => { setIsFaltanteOpen(open); if (!open) resetFaltanteForm(); }}>
                <DialogTrigger nativeButton={true} render={<Button className="gap-2" />}>
                  <Plus className="w-4 h-4" />
                  Registrar Faltante
                </DialogTrigger>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>{editingFaltanteId ? "Editar Producto Faltante" : "Registrar Producto Faltante"}</DialogTitle>
                    <DialogDescription>
                      Un registro por producto. Si el producto existe en el catálogo ERP, búscalo con el ícono de búsqueda; si no existe, escribe la descripción manualmente.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-2">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Producto</label>
                      <p className="text-[10px] text-slate-500 -mt-1">
                        Solo un producto por registro. Usa el ícono <Search className="inline w-3 h-3 -mt-0.5" /> para buscarlo en el catálogo, o escribe la descripción si no existe.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Descripción del producto"
                          value={newFaltante.productoDescripcion}
                          onChange={(e) => setNewFaltante({ ...newFaltante, productoDescripcion: e.target.value, productoId: "" })}
                          className="flex-1"
                        />
                        <Popover open={isProductoSearchOpen} onOpenChange={setIsProductoSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="icon" className="shrink-0">
                              <Search className="w-4 h-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[340px]" align="end">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Buscar por descripción, clave, número de parte, código de barras..."
                                value={productoSearch}
                                onValueChange={setProductoSearch}
                              />
                              <CommandList>
                                {(() => {
                                  const rawQ = productoSearch.trim().toLowerCase();
                                  if (!rawQ) {
                                    return (
                                      <div className="py-6 text-center text-xs text-slate-500">
                                        Escribe para buscar entre {productos.length.toLocaleString()} productos activos
                                      </div>
                                    );
                                  }
                                  const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
                                  const q = squash(rawQ);
                                  const MAX = 50;
                                  const matches: Product[] = [];
                                  for (const p of productos) {
                                    if (
                                      squash(p.descripcion).includes(q) ||
                                      squash(p.descripcionCorta || '').includes(q) ||
                                      squash(p.claveCorta || '').includes(q) ||
                                      squash(p.numeroParte || '').includes(q) ||
                                      (p.barras || '').includes(rawQ) ||
                                      p.id.includes(rawQ)
                                    ) {
                                      matches.push(p);
                                      if (matches.length >= MAX) break;
                                    }
                                  }
                                  if (matches.length === 0) return <CommandEmpty>Sin resultados.</CommandEmpty>;
                                  return (
                                    <CommandGroup>
                                      {matches.map(p => (
                                        <CommandItem
                                          key={p.id}
                                          value={p.id}
                                          onSelect={() => {
                                            setNewFaltante({ ...newFaltante, productoId: p.id, productoDescripcion: p.descripcion });
                                            setIsProductoSearchOpen(false);
                                          }}
                                        >
                                          <div className="flex flex-col">
                                            <span className="text-sm font-medium">{p.descripcion}</span>
                                            <span className="text-[10px] text-slate-500">
                                              {p.claveCorta || p.numeroParte || p.id}
                                              {p.unidadVenta ? ` · ${p.unidadVenta}` : ''}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  );
                                })()}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      {newFaltante.productoId && (
                        <p className="text-[10px] text-emerald-700">Vinculado a producto ERP {newFaltante.productoId}</p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Cantidad solicitada</label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newFaltante.cantidad || ""}
                        onChange={(e) => setNewFaltante({ ...newFaltante, cantidad: Number(e.target.value) })}
                      />
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Cliente (opcional)</label>
                      <Popover open={isFaltanteClientSearchOpen} onOpenChange={setIsFaltanteClientSearchOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-normal">
                            {newFaltante.clienteId
                              ? `${newFaltante.clienteId} — ${newFaltante.clienteName}`
                              : "Sin cliente vinculado"}
                            <Search className="w-3 h-3 ml-2 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[320px]" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Buscar cliente por nombre o ID..."
                              value={faltanteClientSearch}
                              onValueChange={setFaltanteClientSearch}
                            />
                            <CommandList>
                              {(() => {
                                const rawQ = faltanteClientSearch.trim().toLowerCase();
                                if (!rawQ) {
                                  return (
                                    <div className="py-6 text-center text-xs text-slate-500">
                                      Opcional — escribe para buscar
                                    </div>
                                  );
                                }
                                const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
                                const q = squash(rawQ);
                                const norm = (v?: string) => /^\d+$/.test(v || "") ? String(parseInt(v!, 10)) : (v || "").trim();
                                const sellerSucursalId = currentUser?.role === "Seller" ? norm(currentUser.sucursalId) : null;
                                const MAX = 50;
                                const matches: Client[] = [];
                                for (const c of clients) {
                                  if (sellerSucursalId && norm(c.sucursalId) !== sellerSucursalId) continue;
                                  if (
                                    squash(c.company).includes(q) ||
                                    squash(c.tradeName || '').includes(q) ||
                                    squash(c.name).includes(q) ||
                                    c.id.includes(rawQ)
                                  ) {
                                    matches.push(c);
                                    if (matches.length >= MAX) break;
                                  }
                                }
                                if (matches.length === 0) return <CommandEmpty>Sin resultados.</CommandEmpty>;
                                return (
                                  <CommandGroup>
                                    <CommandItem
                                      value="__none__"
                                      onSelect={() => {
                                        setNewFaltante({ ...newFaltante, clienteId: "", clienteName: "" });
                                        setIsFaltanteClientSearchOpen(false);
                                      }}
                                    >
                                      <span className="text-xs italic text-slate-500">Sin cliente</span>
                                    </CommandItem>
                                    {matches.map(c => (
                                      <CommandItem
                                        key={c.id}
                                        value={c.id}
                                        onSelect={() => {
                                          setNewFaltante({ ...newFaltante, clienteId: c.id, clienteName: c.tradeName || c.company });
                                          setIsFaltanteClientSearchOpen(false);
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span className="text-xs font-mono text-slate-500">{c.id}</span>
                                          <span className="text-sm font-medium">{c.tradeName || c.company}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                );
                              })()}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Comentario / razón</label>
                      <Textarea
                        placeholder="Razón dada por compras o logística (ej. proveedor sin existencia, llegada en 2 semanas, descontinuado...)"
                        value={newFaltante.comentario}
                        onChange={(e) => setNewFaltante({ ...newFaltante, comentario: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsFaltanteOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSubmitFaltante}>{editingFaltanteId ? "Guardar cambios" : "Registrar"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-gray ml-1">Sucursal</p>
                <Select value={faltantesFilterSucursal} onValueChange={setFaltantesFilterSucursal}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Todas las Sucursales" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Sucursales</SelectItem>
                    {sucursales.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-gray ml-1">Mes</p>
                <Select value={faltantesFilterMonth} onValueChange={setFaltantesFilterMonth}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Todos los meses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los meses</SelectItem>
                    {faltantesMonthOptions.map(ym => {
                      const [y, m] = ym.split("-").map(Number);
                      return <SelectItem key={ym} value={ym}>{`${MESES[m - 1]} ${y}`}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-brand-gray ml-1">Estado</p>
                <Select value={faltantesFilterEstado} onValueChange={(v) => setFaltantesFilterEstado(v as "all" | "pendiente" | "resuelto")}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendiente">Pendientes</SelectItem>
                    <SelectItem value="resuelto">Resueltos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {currentUser.role === "Admin" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="bg-white lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold text-brand-navy">Productos más solicitados sin existencia</CardTitle>
                    <CardDescription className="text-[10px]">{faltantesRollup.totalIncidentes} incidentes en el filtro actual</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                    {faltantesRollup.topProducts.length === 0 ? (
                      <p className="text-xs italic text-slate-400 text-center py-8">Sin datos para el filtro actual.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Producto</TableHead>
                            <TableHead className="text-[10px] text-right">Incid.</TableHead>
                            <TableHead className="text-[10px] text-right">Cant.</TableHead>
                            <TableHead className="text-[10px] text-right">Sucs.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {faltantesRollup.topProducts.map((p, i) => (
                            <TableRow key={`${p.productoId || p.name}-${i}`}>
                              <TableCell className="text-xs leading-tight">
                                <div className="font-medium text-slate-900 line-clamp-2">{p.name}</div>
                                {p.productoId && <span className="text-[9px] font-mono text-slate-400">{p.productoId}</span>}
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold text-amber-700">{p.incidentes}</TableCell>
                              <TableCell className="text-right text-xs">{p.cantidad}</TableCell>
                              <TableCell className="text-right text-xs">{p.sucursales.size}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold text-brand-navy">Por sucursal</CardTitle>
                    <CardDescription className="text-[10px]">Volumen de incidentes y producto más afectado</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-[320px] overflow-y-auto">
                    {faltantesRollup.bySucursal.length === 0 ? (
                      <p className="text-xs italic text-slate-400 text-center py-8">Sin datos.</p>
                    ) : (() => {
                      const max = faltantesRollup.bySucursal[0]?.incidentes || 1;
                      return faltantesRollup.bySucursal.map(s => (
                        <div key={s.name} className="space-y-1">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-medium text-slate-700 truncate pr-2">{s.name}</span>
                            <span className="font-bold text-amber-700">{s.incidentes}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(s.incidentes / max) * 100}%` }} />
                          </div>
                          {s.topProduct && (
                            <p className="text-[10px] text-slate-500 truncate">
                              Top: <span className="text-slate-700">{s.topProduct}</span> <span className="text-slate-400">×{s.topProductCount}</span>
                            </p>
                          )}
                        </div>
                      ));
                    })()}
                  </CardContent>
                </Card>

              </div>
            )}

            {currentUser.role === "Admin" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="flex flex-col gap-4">
                  <Card className="bg-white">
                    <CardHeader className="pb-1 pt-3">
                      <CardDescription className="text-[10px] uppercase tracking-wide">Cobertura del catálogo</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-1 pb-3">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-2xl font-bold ${faltantesRollup.freeTextPct >= 30 ? "text-amber-700" : "text-brand-navy"}`}>{faltantesRollup.freeTextPct}%</span>
                        <span className="text-[10px] text-slate-500">descripciones libres</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {faltantesRollup.freeTextCount} sin vínculo a producto ERP — posible brecha en el catálogo.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-white flex-1 min-h-0">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base font-bold text-brand-navy">Recurrencia crónica</CardTitle>
                    <CardDescription className="text-[10px]">Productos faltantes en 3 o más meses distintos (ignora el filtro de mes)</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                    {faltantesRollup.recurrentes.length === 0 ? (
                      <p className="text-xs italic text-slate-400 text-center py-8">Aún no hay productos con recurrencia crónica.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Producto</TableHead>
                            <TableHead className="text-[10px] text-right">Meses</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {faltantesRollup.recurrentes.map((p, i) => (
                            <TableRow key={`${p.key}-${i}`}>
                              <TableCell className="text-xs leading-tight">
                                <div className="font-medium text-slate-900 line-clamp-2">{p.name}</div>
                                {p.productoId && <span className="text-[9px] font-mono text-slate-400">{p.productoId}</span>}
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold text-amber-700">{p.meses}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
                </div>

                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold text-brand-navy">Clientes más afectados</CardTitle>
                    <CardDescription className="text-[10px]">Quiénes pierden más oportunidades por falta de stock</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                    {faltantesRollup.topClientes.length === 0 ? (
                      <p className="text-xs italic text-slate-400 text-center py-8">Sin clientes vinculados en el filtro actual.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Cliente</TableHead>
                            <TableHead className="text-[10px] text-right">Incid.</TableHead>
                            <TableHead className="text-[10px] text-right">Cant.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {faltantesRollup.topClientes.map((c: { id: string; name: string; incidentes: number; cantidad: number }) => (
                            <TableRow key={c.id}>
                              <TableCell className="text-xs leading-tight">
                                <div className="font-medium text-slate-900 line-clamp-2">{c.name}</div>
                                <span className="text-[9px] font-mono text-slate-400">{c.id}</span>
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold text-amber-700">{c.incidentes}</TableCell>
                              <TableCell className="text-right text-xs">{c.cantidad}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-bold text-brand-navy">Productos nuevos este mes</CardTitle>
                    <CardDescription className="text-[10px]">Productos que aparecen como faltantes por primera vez en {faltantesRollup.currLabel}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                    {faltantesRollup.productosNuevos.length === 0 ? (
                      <p className="text-xs italic text-slate-400 text-center py-8">Sin productos nuevos este mes.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Producto</TableHead>
                            <TableHead className="text-[10px] text-right">Incid.</TableHead>
                            <TableHead className="text-[10px] text-right">Cant.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {faltantesRollup.productosNuevos.map((p: { key: string; name: string; productoId: string | null; cantidad: number; incidentes: number }, i: number) => (
                            <TableRow key={`${p.key}-${i}`}>
                              <TableCell className="text-xs leading-tight">
                                <div className="font-medium text-slate-900 line-clamp-2">{p.name}</div>
                                {p.productoId && <span className="text-[9px] font-mono text-slate-400">{p.productoId}</span>}
                              </TableCell>
                              <TableCell className="text-right text-xs font-bold text-amber-700">{p.incidentes}</TableCell>
                              <TableCell className="text-right text-xs">{p.cantidad}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {(() => {
                const visible = filteredFaltantes;
                if (visible.length === 0) {
                  return (
                    <Card className="border-dashed border-2 bg-transparent">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                        <AlertTriangle className="w-10 h-10 opacity-20" />
                        <p className="text-sm">{currentUser.role === "Seller" ? "Aún no has registrado faltantes." : "No hay faltantes registrados."}</p>
                      </CardContent>
                    </Card>
                  );
                }
                return visible.map(f => (
                  <Card key={f.id} className="bg-white">
                    <CardContent className="p-4 flex flex-col md:flex-row md:items-start gap-4 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm text-slate-900">{f.productoDescripcion}</h4>
                          <Badge variant="outline" className={f.estado === "pendiente" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}>
                            {f.estado === "pendiente" ? "Pendiente" : "Resuelto"}
                          </Badge>
                          {f.productoId && <span className="text-[10px] font-mono text-slate-400">ERP {f.productoId}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span>Cantidad: <span className="font-semibold text-slate-700">{f.cantidad}</span></span>
                          {f.clienteName && <span>Cliente: <span className="font-medium text-slate-700">{f.clienteName}</span></span>}
                          {currentUser.role === "Admin" && f.vendedorName && <span>Vendedor: <span className="font-medium text-slate-700">{f.vendedorName}</span></span>}
                          {f.sucursalName && <span>Sucursal: <span className="font-medium text-slate-700">{f.sucursalName}</span></span>}
                          <span>Registrado: {new Date(f.createdAt).toLocaleDateString()}</span>
                        </div>
                        {f.comentario && (
                          <p className="text-xs text-slate-600 italic mt-2 leading-snug">{f.comentario}</p>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        {currentUser.role === "Admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEditFaltante(f)}
                          >
                            Editar
                          </Button>
                        )}
                        {(currentUser.role === "Admin" || f.vendedorId === currentUser.id) && (
                          <Button
                            size="sm"
                            variant={f.estado === "pendiente" ? "outline" : "ghost"}
                            onClick={() => toggleFaltanteEstado(f)}
                          >
                            {f.estado === "pendiente" ? "Marcar resuelto" : "Reabrir"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ));
              })()}
            </div>
          </TabsContent>

          {currentUser.role === "Admin" && (
            <TabsContent value="admin" className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Centro de Administración</h2>
                  <p className="text-slate-500">Gestiona roles de usuario, metas y supervisa la carga de trabajo del equipo.</p>
                </div>
                <Tabs value={adminSubTab} onValueChange={setAdminSubTab} className="w-full md:w-auto">
                  <TabsList variant="line" className="border-b">
                    <TabsTrigger value="users" className="text-xs px-4">Usuarios</TabsTrigger>
                    <TabsTrigger value="workload" className="text-xs px-4">Carga de Trabajo</TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs px-4">Actividad Global</TabsTrigger>
                    <TabsTrigger value="goals" className="text-xs px-4">Metas por Sucursal</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {adminSubTab === "users" && (
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Settings className="w-5 h-5 text-slate-400" />
                            Gestión de Usuarios
                          </CardTitle>
                          <CardDescription>Asigna roles y establece objetivos de ventas individuales.</CardDescription>
                        </div>
                        <Dialog open={isNewUserOpen} onOpenChange={setIsNewUserOpen}>
                          <DialogTrigger render={<Button className="gap-2" />}>
                            <UserPlus className="w-4 h-4" />
                            Agregar Usuario
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Agregar Nuevo Miembro al Equipo</DialogTitle>
                              <DialogDescription>Crea una nueva cuenta de usuario para el CRM.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Nombre Completo</label>
                                <Input 
                                  placeholder="Juan Pérez" 
                                  value={newUser.name}
                                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Correo Electrónico</label>
                                <Input 
                                  type="email"
                                  placeholder="juan@ecosistemas.com.mx" 
                                  value={newUser.email}
                                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <label className="text-sm font-medium">Rol</label>
                                  <Select 
                                    value={newUser.role} 
                                    onValueChange={(val) => setNewUser({...newUser, role: val as "Admin" | "Seller"})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Admin">Admin</SelectItem>
                                      <SelectItem value="Seller">Vendedor</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <label className="text-sm font-medium">Sucursal</label>
                                  <Select 
                                    value={newUser.sucursal} 
                                    onValueChange={(val) => setNewUser({...newUser, sucursal: val})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {sucursales.map(s => (
                                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Meta de Ventas ($)</label>
                                <Input 
                                  type="number"
                                  value={newUser.salesGoal || ""}
                                  onChange={(e) => setNewUser({...newUser, salesGoal: Number(e.target.value)})}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>Cancelar</Button>
                              <Button onClick={handleCreateUser} disabled={!newUser.name || !newUser.email}>Crear Usuario</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardHeader>
                    <div className="px-6 py-3 border-b flex flex-wrap gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-brand-gray">Sucursal</p>
                        <Select value={adminFilterSucursal} onValueChange={setAdminFilterSucursal}>
                          <SelectTrigger className="w-[160px] h-8">
                            <SelectValue placeholder="Todas las Sucursales" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas las Sucursales</SelectItem>
                            {sucursales.map(s => (
                              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-brand-gray">Segmento</p>
                        <Select value={adminFilterSegmento} onValueChange={setAdminFilterSegmento}>
                          <SelectTrigger className="w-[160px] h-8">
                            <SelectValue placeholder="Todos los Segmentos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos los Segmentos</SelectItem>
                            {segmentos.map(s => (
                              <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="font-semibold">Usuario</TableHead>
                            <TableHead className="font-semibold">Rol</TableHead>
                            <TableHead className="font-semibold">Meta de Ventas ($)</TableHead>
                            <TableHead className="text-right font-semibold">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users
                            .filter(user => {
                              if (adminFilterSucursal !== "all" && user.sucursalId !== sucursales.find(s => s.name === adminFilterSucursal)?.id) return false;
                              if (adminFilterSegmento !== "all" && !leads.some(l => l.assignedTo === user.id && l.segmento === adminFilterSegmento)) return false;
                              return true;
                            })
                            .map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">{user.name}</span>
                                  <span className="text-xs text-slate-400">{user.email}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Select 
                                  value={user.role} 
                                  onValueChange={(val) => handleUpdateRole(user.id, val as "Admin" | "Seller")}
                                >
                                  <SelectTrigger className="w-[110px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Admin">Admin</SelectItem>
                                    <SelectItem value="Seller">Vendedor</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    className="w-28 h-8"
                                    defaultValue={user.performance.salesGoal}
                                    onBlur={(e) => {
                                      const newVal = Number(e.target.value);
                                      if (newVal !== user.performance.salesGoal) {
                                        handleUpdateGoal(user.id, newVal);
                                      }
                                    }}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" className="h-8" onClick={() => handleOpenUserDetail(user)}>Ver Detalles</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* User Detail Dialog */}
                <Dialog open={!!selectedUserDetail} onOpenChange={(open) => { if (!open) setSelectedUserDetail(null); }}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-slate-400" />
                        {selectedUserDetail?.name}
                      </DialogTitle>
                      <DialogDescription>
                        {selectedUserDetail?.role === "Admin" ? "Administrador" : "Vendedor"} · ID: {selectedUserDetail?.id}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2 max-h-[75vh] overflow-y-auto pr-1">
                      {/* Key stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-slate-50 p-3 text-center">
                          <p className="text-xs text-slate-400">Leads activos</p>
                          <p className="text-xl font-bold">{selectedUserDetail?.workload?.activeLeads ?? 0}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 text-center">
                          <p className="text-xs text-slate-400">Cerrados</p>
                          <p className="text-xl font-bold">{selectedUserDetail?.performance.totalClosed ?? 0}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3 text-center">
                          <p className="text-xs text-slate-400">Pipeline</p>
                          <p className="text-xl font-bold">${((selectedUserDetail?.workload?.pipelineValue ?? 0) / 1000).toFixed(0)}k</p>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-medium text-brand-gray mb-1">Sucursal</p>
                          <p>{sucursales.find(s => s.id === selectedUserDetail?.sucursalId)?.name || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-brand-gray mb-1">Meta del mes</p>
                          <p>${(selectedUserDetail?.performance.salesGoal ?? 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-brand-gray mb-1">Valor cerrado</p>
                          <p>${(selectedUserDetail?.performance.totalValue ?? 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-brand-gray mb-1">Conversión</p>
                          <p>{((selectedUserDetail?.performance.conversionRate ?? 0) * 100).toFixed(0)}%</p>
                        </div>
                      </div>

                      {/* Goals timeline */}
                      <div className="space-y-2 border-t pt-4">
                        <p className="text-sm font-semibold">Historial de Metas</p>
                        {goalsLoading ? (
                          <p className="text-xs text-slate-400">Cargando...</p>
                        ) : userGoalsTimeline.length === 0 ? (
                          <p className="text-xs text-slate-400">Sin metas registradas.</p>
                        ) : (
                          <div className="space-y-2">
                            {userGoalsTimeline.map((g) => {
                              const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                              const pct = g.meta > 0 ? Math.min(100, Math.round((g.invoiced / g.meta) * 100)) : 0;
                              const label = `${MONTHS[g.month - 1]} ${g.year}`;
                              const badgeClass = g.status === "achieved" ? "bg-green-50 text-green-700 border-green-200"
                                : g.status === "missed" ? "bg-red-50 text-red-700 border-red-200"
                                : g.status === "current" ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-slate-50 text-slate-500 border-slate-200";
                              const badgeLabel = g.status === "achieved" ? "Cumplida" : g.status === "missed" ? "No cumplida" : g.status === "current" ? "En curso" : "Próxima";
                              return (
                                <div key={g.id} className="rounded-lg border p-3 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold">{label}</span>
                                    <Badge variant="outline" className={`text-[10px] ${badgeClass}`}>{badgeLabel}</Badge>
                                  </div>
                                  <div className="flex justify-between text-[11px] text-slate-500">
                                    <span>Meta: <span className="font-semibold text-slate-700">${g.meta.toLocaleString()}</span></span>
                                    <span>Facturado: <span className="font-semibold text-slate-700">${g.invoiced.toLocaleString()}</span></span>
                                    <span className="font-bold">{pct}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all ${g.status === "achieved" ? "bg-green-500" : g.status === "missed" ? "bg-red-400" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Update email */}
                      <div className="space-y-2 border-t pt-4">
                        <p className="text-sm font-semibold">Actualizar correo</p>
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            value={userDetailEmail}
                            onChange={(e) => setUserDetailEmail(e.target.value)}
                            className="h-8"
                          />
                          <Button size="sm" onClick={handleUpdateUserEmail} disabled={!userDetailEmail || userDetailEmail === selectedUserDetail?.email}>
                            Guardar
                          </Button>
                        </div>
                      </div>

                      {/* Reset password */}
                      <div className="space-y-2 border-t pt-4">
                        <p className="text-sm font-semibold">Restablecer contraseña</p>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder="Nueva contraseña"
                            value={userDetailPassword}
                            onChange={(e) => setUserDetailPassword(e.target.value)}
                            className="h-8"
                          />
                          <Button size="sm" onClick={handleResetPassword} disabled={!userDetailPassword}>
                            Guardar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {adminSubTab === "workload" && (
                  <div className="space-y-6">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card className="bg-white">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-500">Total de Leads</p>
                              <h3 className="text-2xl font-bold">{leads.length}</h3>
                            </div>
                            <div className="bg-blue-50 p-2 rounded-lg">
                              <Users className="w-5 h-5 text-blue-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-white">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-500">Nuevos Leads</p>
                              <h3 className="text-2xl font-bold">{leads.filter(l => l.status === "ASIGNADO").length}</h3>
                            </div>
                            <div className="bg-orange-50 p-2 rounded-lg">
                              <Clock className="w-5 h-5 text-orange-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-white">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-500">Tratos Cerrados</p>
                              <h3 className="text-2xl font-bold">{leads.filter(l => l.status === "ENTREGADO").length}</h3>
                            </div>
                            <div className="bg-green-50 p-2 rounded-lg">
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="bg-white">
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-slate-500">Pipeline Total</p>
                              <h3 className="text-2xl font-bold">${leads.reduce((acc, l) => acc + l.value, 0).toLocaleString()}</h3>
                            </div>
                            <div className="bg-indigo-50 p-2 rounded-lg">
                              <TrendingUp className="w-5 h-5 text-indigo-600" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-slate-400" />
                        Supervisión de Carga de Trabajo
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-brand-gray ml-1">Buscar</p>
                          <div className="relative w-full md:w-64">
                            <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                              placeholder="Buscar leads o empresas..." 
                              className="pl-9 h-9"
                              value={adminSearch}
                              onChange={(e) => setAdminSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-brand-gray ml-1">Vendedor</p>
                          <Select value={adminFilterSeller} onValueChange={setAdminFilterSeller}>
                            <SelectTrigger className="w-[150px] h-9">
                              <SelectValue placeholder="Todos los Vendedores" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos los Vendedores</SelectItem>
                              <SelectItem value="unassigned">Sin asignar</SelectItem>
                              {users
                                .filter(u => adminFilterSucursal === "all" || u.sucursalId === sucursales.find(s => s.name === adminFilterSucursal)?.id)
                                .map(u => (
                                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))
                              }
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-brand-gray ml-1">Sucursal</p>
                          <Select value={adminFilterSucursal} onValueChange={setAdminFilterSucursal}>
                            <SelectTrigger className="w-[150px] h-9">
                              <SelectValue placeholder="Todas las Sucursales" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas las Sucursales</SelectItem>
                              {sucursales.map(s => (
                                <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <Card className="bg-white">
                      <CardHeader className="pb-2">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
                          <div>
                            <CardTitle className="text-base font-bold text-brand-navy">Carga por vendedor</CardTitle>
                            <CardDescription className="text-[11px]">Volumen activo, valor de pipeline y conversión por persona. Conversión promedio del equipo: <span className="font-semibold text-brand-navy">{workloadInsights.teamAvgConv}%</span></CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        {workloadInsights.stats.length === 0 ? (
                          <div className="py-10 text-center text-xs text-slate-400">Sin vendedores que coincidan con los filtros actuales.</div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-[10px]">Vendedor</TableHead>
                                <TableHead className="text-[10px]">Sucursal</TableHead>
                                <TableHead className="text-[10px] text-right">Carga</TableHead>
                                <TableHead className="text-[10px] text-right">Pipeline</TableHead>
                                <TableHead className="text-[10px] text-right">Stuck &gt;1d</TableHead>
                                <TableHead className="text-[10px] text-right">Cerrados (mes)</TableHead>
                                <TableHead className="text-[10px] text-right">Conv. %</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {workloadInsights.stats.map((s: { user: User; sucursalName: string; activeLeads: number; pipelineValue: number; stuckCount: number; closedThisMonth: number; convPct: number }) => {
                                const loadColor = s.activeLeads > 10 ? "text-red-600" : s.activeLeads > 5 ? "text-orange-600" : "text-emerald-600";
                                const loadBar = s.activeLeads > 10 ? "bg-red-500" : s.activeLeads > 5 ? "bg-orange-500" : "bg-emerald-500";
                                const convColor = s.convPct >= workloadInsights.teamAvgConv ? "text-emerald-700" : "text-amber-700";
                                return (
                                  <TableRow key={s.user.id}>
                                    <TableCell className="text-xs">
                                      <div className="font-medium text-slate-900">{s.user.name}</div>
                                      <div className="text-[10px] text-slate-400">{s.user.role}</div>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-600">{s.sucursalName}</TableCell>
                                    <TableCell className="text-right text-xs">
                                      <div className={`font-bold ${loadColor}`}>{s.activeLeads}</div>
                                      <div className="h-1 w-16 ml-auto bg-slate-100 rounded-full overflow-hidden mt-0.5">
                                        <div className={`h-full ${loadBar}`} style={{ width: `${Math.min((s.activeLeads / 15) * 100, 100)}%` }} />
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right text-xs font-mono">${s.pipelineValue.toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-xs">
                                      <span className={s.stuckCount > 0 ? "font-bold text-red-600" : "text-slate-400"}>{s.stuckCount}</span>
                                    </TableCell>
                                    <TableCell className="text-right text-xs font-semibold text-slate-700">{s.closedThisMonth}</TableCell>
                                    <TableCell className={`text-right text-xs font-bold ${convColor}`}>{s.convPct}%</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <h3 className="text-lg font-bold">Necesita intervención</h3>
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          {workloadInsights.stuckLeads.length} {workloadInsights.stuckLeads.length === 1 ? "lead" : "leads"}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 -mt-1">Leads activos sin actualización en más de 24 h. Críticos rojos: sin movimiento en más de 3 días.</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {workloadInsights.stuckLeads.length === 0 ? (
                          <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border-2 border-dashed border-slate-100">
                            <CheckCircle2 className="w-8 h-8 mb-2 opacity-30 text-emerald-500" />
                            <p className="text-sm">Sin leads atascados en el filtro actual.</p>
                          </div>
                        ) : (
                          workloadInsights.stuckLeads.map((lead: Lead) => {
                            const stuckLevel = getStuckLevel(lead.updatedAt);
                            return (
                              <Card key={lead.id} className={cn(
                                "bg-white hover:bg-slate-50 transition-colors cursor-pointer relative overflow-hidden",
                                stuckLevel === "critical" && "border-red-300 bg-red-50/40",
                                stuckLevel === "warning" && "border-orange-300 bg-orange-50/40"
                              )} onClick={() => openStatusUpdate(lead)}>
                                <div className={cn(
                                  "absolute top-0 right-0 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white rounded-bl-lg",
                                  stuckLevel === "critical" ? "bg-red-500" : "bg-orange-500"
                                )}>
                                  {stuckLevel === "critical" ? "Retraso Crítico" : "Retrasado"}
                                </div>
                                <CardHeader className="p-4 pb-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {getStatusBadge(lead.status)}
                                      {lead.mostrador && (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] uppercase tracking-wide">Mostrador</Badge>
                                      )}
                                    </div>
                                    <span className="text-xs font-medium text-brand-gray">ID: {lead.id}</span>
                                  </div>
                                  <CardTitle className="text-base font-bold">{lead.name}</CardTitle>
                                  <CardDescription className="text-xs">{lead.company}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-4 pt-2 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">Valor</span>
                                    <span className="text-sm font-mono font-bold text-primary">${lead.value.toLocaleString()}</span>
                                  </div>
                                  <div className="space-y-2 pt-2 border-t border-slate-50">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold">
                                          {lead.assignedTo ? users.find((u: User) => u.id === lead.assignedTo)?.name.charAt(0) : "?"}
                                        </div>
                                        <span className="text-xs text-slate-600">
                                          {lead.assignedTo ? users.find((u: User) => u.id === lead.assignedTo)?.name : "Sin asignar"}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between bg-slate-50/50 p-2 rounded-lg">
                                      <span className="text-[10px] font-medium text-slate-500">Tiempo sin actualizar:</span>
                                      <div className="flex items-center gap-1">
                                        <AlertTriangle className={cn("w-3 h-3", stuckLevel === "critical" ? "text-red-500" : "text-orange-500")} />
                                        <span className={cn(
                                          "text-[10px] font-bold",
                                          stuckLevel === "critical" ? "text-red-600" : "text-orange-600"
                                        )}>
                                          {getTimeStuck(lead.updatedAt)}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {adminSubTab === "activity" && (
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <History className="w-5 h-5 text-slate-400" />
                            Línea de Tiempo de Actividad Global
                          </CardTitle>
                          <CardDescription>Un historial completo de todas las actualizaciones del equipo.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={adminFilterSeller} onValueChange={setAdminFilterSeller}>
                            <SelectTrigger className="w-[150px] h-8 text-xs">
                              <SelectValue placeholder="Filtrar por Vendedor" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todos los Vendedores</SelectItem>
                              {users.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="font-semibold">Vendedor</TableHead>
                            <TableHead className="font-semibold">Lead / Empresa</TableHead>
                            <TableHead className="font-semibold">Actualización</TableHead>
                            <TableHead className="font-semibold">Comentario</TableHead>
                            <TableHead className="font-semibold">Monto</TableHead>
                            <TableHead className="text-right font-semibold">Fecha</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leads
                            .flatMap(l => l.history.map(h => ({ ...h, leadName: l.name, leadCompany: l.company, leadId: l.id, assignedTo: l.assignedTo })))
                            .filter(h => adminFilterSeller === "all" || h.updatedBy === adminFilterSeller)
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .map((update) => (
                              <TableRow key={update.id} className="group hover:bg-slate-50/50 transition-colors">
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                      {users.find(u => u.id === update.updatedBy)?.name.charAt(0) || "S"}
                                    </div>
                                    <span className="text-sm font-medium">
                                      {users.find(u => u.id === update.updatedBy)?.name || "Sistema"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700">{update.leadName}</span>
                                    <span className="text-[10px] text-slate-400">{update.leadCompany}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {getStatusBadge(update.status)}
                                </TableCell>
                                <TableCell className="max-w-[250px]">
                                  <p className="text-xs text-slate-600 line-clamp-2 italic">"{update.comment}"</p>
                                </TableCell>
                                <TableCell>
                                  {update.quotedAmount !== undefined && (
                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">
                                      C: ${update.quotedAmount.toLocaleString()}
                                    </span>
                                  )}
                                  {update.invoicedAmount !== undefined && (
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                      F: ${update.invoicedAmount.toLocaleString()}
                                    </span>
                                  )}
                                  {update.quotedAmount === undefined && update.invoicedAmount === undefined && (
                                    <span className="text-[10px] text-slate-300">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex flex-col items-end">
                                    <span className="text-xs font-medium text-slate-600">{new Date(update.timestamp).toLocaleDateString()}</span>
                                    <span className="text-[10px] text-slate-400">{new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          {leads.flatMap(l => l.history).length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="h-32 text-center text-slate-400">
                                Aún no se ha registrado actividad.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {adminSubTab === "goals" && (
                  <div className="space-y-6">
                    <Card className="border-none bg-brand-navy text-white">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg flex items-center gap-2 text-white">
                          <Target className="w-5 h-5 text-white/70" />
                          Establecer Meta por Sucursal
                        </CardTitle>
                        <CardDescription className="text-white/70">Aplica una meta de ventas a todos los vendedores activos de una sucursal para el período seleccionado.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                          <div className="grid gap-2">
                            <label className="text-sm font-medium text-white/90">Sucursal</label>
                            <Select value={branchGoal.sucursalId} onValueChange={(val) => setBranchGoal({...branchGoal, sucursalId: val})}>
                              <SelectTrigger className="bg-white text-foreground border-transparent">
                                <SelectValue placeholder="Seleccionar sucursal" />
                              </SelectTrigger>
                              <SelectContent>
                                {sucursales.map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.id})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <label className="text-sm font-medium text-white/90">Mes</label>
                            <Select value={String(branchGoal.month)} onValueChange={(val) => setBranchGoal({...branchGoal, month: Number(val)})}>
                              <SelectTrigger className="bg-white text-foreground border-transparent">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MESES.map((name, i) => (
                                  <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <label className="text-sm font-medium text-white/90">Año</label>
                            <Select value={String(branchGoal.year)} onValueChange={(val) => setBranchGoal({...branchGoal, year: Number(val)})}>
                              <SelectTrigger className="bg-white text-foreground border-transparent">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <label className="text-sm font-medium text-white/90">Meta ($)</label>
                            <Input
                              type="number"
                              placeholder="50000"
                              value={branchGoal.amount || ""}
                              onChange={(e) => setBranchGoal({...branchGoal, amount: Number(e.target.value)})}
                              className="bg-white text-foreground border-transparent placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                        {branchGoal.sucursalId && (
                          <p className="text-xs text-white/60 mt-3">
                            Afectará a {users.filter(u => u.role === "Seller" && u.sucursalId === branchGoal.sucursalId).length} vendedor(es) activo(s) en {sucursales.find(s => s.id === branchGoal.sucursalId)?.name}.
                          </p>
                        )}
                        <div className="mt-4">
                          <Button onClick={handleSetBranchGoal} disabled={!branchGoal.sucursalId || !branchGoal.amount} className="gap-2">
                            <Target className="w-4 h-4" />
                            Aplicar Meta
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-slate-400" />
                          Metas Actuales por Sucursal
                        </CardTitle>
                        <CardDescription>Meta del mes en curso para cada vendedor activo.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/50">
                              <TableHead className="font-semibold">Sucursal</TableHead>
                              <TableHead className="font-semibold">Vendedor</TableHead>
                              <TableHead className="font-semibold text-right">Meta Actual ($)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sucursales.flatMap(s =>
                              users
                                .filter(u => u.role === "Seller" && u.sucursalId === s.id)
                                .map((u, idx) => (
                                  <TableRow key={u.id}>
                                    <TableCell className="font-medium text-slate-600">
                                      {idx === 0 ? s.name : ""}
                                    </TableCell>
                                    <TableCell>{u.name}</TableCell>
                                    <TableCell className="text-right font-mono">
                                      {u.performance.salesGoal ? `$${u.performance.salesGoal.toLocaleString()}` : <span className="text-slate-400 text-xs">Sin meta</span>}
                                    </TableCell>
                                  </TableRow>
                                ))
                            )}
                            {users.filter(u => u.role === "Seller").length === 0 && (
                              <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center text-slate-400">No hay vendedores activos.</TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Status Update Dialog */}
      <Dialog open={isStatusUpdateOpen} onOpenChange={setIsStatusUpdateOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col p-0">
          <div className="flex flex-col md:flex-row h-full">
            {/* Left Side: Timeline History */}
            <div className={cn(
              "flex flex-col border-slate-100",
              statusUpdate.status === selectedLead?.status ? "w-full" : "w-full md:w-1/2 border-r"
            )}>
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Historial: {selectedLead?.name}
                </DialogTitle>
                <DialogDescription>
                  Línea de tiempo de todos los cambios de estado y comentarios.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 pt-4">
                <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
                  {!selectedLead || selectedLead.history.length === 0 ? (
                    <p className="text-center text-slate-400 italic py-8">Aún no se ha registrado historial.</p>
                  ) : (
                    [...selectedLead.history].reverse().map((item) => {
                      const author = users.find(u => u.id === item.updatedBy);
                      const authorName = author?.name || "Sistema";
                      const authorInitial = authorName.charAt(0).toUpperCase();
                      return (
                      <div key={item.id} className="relative pl-8">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-primary" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(item.status)}
                              <span className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                                {authorInitial}
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700">{authorName}</span>
                              {author?.role && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-4 border-slate-200 text-slate-500">
                                  {author.role === "Admin" ? "Admin" : "Vendedor"}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-slate-700 mt-1">{item.comment}</p>
                          {item.rechazoMotivo && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <XCircle className="w-3 h-3 text-red-600" />
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-100 text-[10px] py-0">
                                Motivo: {item.rechazoMotivo}
                              </Badge>
                            </div>
                          )}
                          {(item.quotedAmount !== undefined || item.invoicedAmount !== undefined) && (
                            <div className="flex gap-2 mt-2">
                              {item.quotedAmount !== undefined && (
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-100 text-[9px] py-0">
                                  Cotizado: ${item.quotedAmount.toLocaleString()}
                                </Badge>
                              )}
                              {item.invoicedAmount !== undefined && (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[9px] py-0">
                                  Facturado: ${item.invoicedAmount.toLocaleString()}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                    })
                  )}
                </div>
              </div>
              {statusUpdate.status === selectedLead?.status && (
                <div className="p-4 bg-white border-t space-y-3">
                  <label className="text-sm font-semibold text-brand-navy flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" />
                    Agregar Comentario
                  </label>
                  <Input
                    placeholder="Escribe un comentario..."
                    value={statusUpdate.comment}
                    onChange={(e) => setStatusUpdate({ ...statusUpdate, comment: e.target.value })}
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsStatusUpdateOpen(false)}>Cerrar</Button>
                    <Button
                      size="sm"
                      disabled={!statusUpdate.comment.trim()}
                      onClick={() => handleStatusChange(
                        selectedLead!.id,
                        selectedLead!.status,
                        statusUpdate.comment
                      )}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Update Form */}
            {statusUpdate.status !== selectedLead?.status && (
              <div className="w-full md:w-1/2 flex flex-col bg-slate-50/30">
                <DialogHeader className="p-6 pb-2">
                  <DialogTitle className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-primary" />
                    Nueva Actualización
                  </DialogTitle>
                  <DialogDescription>
                    Registra un nuevo avance para este lead.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4">
                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-brand-navy">Nuevo Estado</label>
                    <Select 
                      value={statusUpdate.status} 
                      onValueChange={(val) => setStatusUpdate({...statusUpdate, status: val as LeadStatus})}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ASIGNADO">Asignado</SelectItem>
                        <SelectItem value="CONTACTADO">Contactado</SelectItem>
                        <SelectItem value="NEGOCIACION">Negociación</SelectItem>
                        <SelectItem value="COTIZADO">Cotizado</SelectItem>
                        <SelectItem value="FACTURADO">Facturado</SelectItem>
                        <SelectItem value="ENTREGADO">Entregado</SelectItem>
                        <SelectItem value="RECHAZADO">Rechazado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-brand-navy flex items-center gap-2">
                      <MessageSquare className="w-3 h-3" />
                      Comentario
                    </label>
                    <Input 
                      placeholder="Describe el avance..." 
                      value={statusUpdate.comment}
                      onChange={(e) => setStatusUpdate({...statusUpdate, comment: e.target.value})}
                      className="bg-white"
                    />
                  </div>

                  {statusUpdate.status === "COTIZADO" && (
                    <div className="grid gap-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <label className="text-xs font-bold text-orange-700 flex items-center gap-2">
                        <TrendingUp className="w-3 h-3" />
                        Monto Cotizado ($)
                      </label>
                      <Input 
                        type="number"
                        placeholder="0.00"
                        value={statusUpdate.quotedAmount || ""}
                        onChange={(e) => setStatusUpdate({...statusUpdate, quotedAmount: Number(e.target.value)})}
                        className="bg-white border-orange-200 focus-visible:ring-orange-500 h-8 text-sm"
                      />
                    </div>
                  )}

                  {statusUpdate.status === "FACTURADO" && (
                    <div className="grid gap-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                      <div className="grid gap-2">
                        <label className="text-xs font-bold text-indigo-700 flex items-center gap-2">
                          <FileText className="w-3 h-3" />
                          Monto Facturado ($)
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={statusUpdate.invoicedAmount || ""}
                          onChange={(e) => setStatusUpdate({...statusUpdate, invoicedAmount: Number(e.target.value)})}
                          className="bg-white border-indigo-200 focus-visible:ring-indigo-500 h-8 text-sm"
                        />
                      </div>

                      {selectedLead && isCrmClientId(selectedLead.clientId) && (
                        <div className="grid gap-2">
                          <label className="text-xs font-bold text-indigo-700 flex items-center gap-2">
                            <Building2 className="w-3 h-3" />
                            Cliente ERP a vincular
                          </label>
                          <p className="text-[10px] text-indigo-700/70 -mt-1">
                            Este lead aún apunta a un prospecto CRM. Selecciona el ID del cliente ERP que ya existe para vincularlo.
                          </p>
                          <Popover open={isErpClientSearchOpen} onOpenChange={setIsErpClientSearchOpen}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between font-normal bg-white border-indigo-200 h-8 text-sm">
                                {statusUpdate.erpClientId
                                  ? (() => {
                                      const c = clients.find(c => c.id === statusUpdate.erpClientId);
                                      return c
                                        ? `${statusUpdate.erpClientId} — ${c.tradeName || c.company}`
                                        : statusUpdate.erpClientId;
                                    })()
                                  : "Buscar cliente ERP por ID, nombre, RFC..."}
                                <Search className="w-3 h-3 ml-2 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="p-0 w-[320px]" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="ID, nombre comercial, razón social, RFC..."
                                  value={erpClientSearch}
                                  onValueChange={setErpClientSearch}
                                />
                                <CommandList>
                                  {(() => {
                                    const rawQ = erpClientSearch.trim().toLowerCase();
                                    if (!rawQ) {
                                      return (
                                        <div className="py-6 text-center text-xs text-slate-500">
                                          Escribe para buscar entre los clientes ERP
                                        </div>
                                      );
                                    }
                                    const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');
                                    const q = squash(rawQ);
                                    const MAX = 50;
                                    const matches: Client[] = [];
                                    // Sellers can only link clients from their own sucursal; admins see all
                                    const norm = (v?: string) => /^\d+$/.test(v || "") ? String(parseInt(v!, 10)) : (v || "").trim();
                                    const sellerSucursalId = currentUser?.role === "Seller" ? norm(currentUser.sucursalId) : null;
                                    for (const c of clients) {
                                      if (c.source !== 'erp') continue;
                                      if (sellerSucursalId && norm(c.sucursalId) !== sellerSucursalId) continue;
                                      const stripped = c.id.replace(/^0+/, '');
                                      if (
                                        squash(c.company).includes(q) ||
                                        squash(c.tradeName || '').includes(q) ||
                                        squash(c.name).includes(q) ||
                                        squash(c.rfc || '').includes(q) ||
                                        c.id.includes(rawQ) ||
                                        stripped.includes(rawQ)
                                      ) {
                                        matches.push(c);
                                        if (matches.length >= MAX) break;
                                      }
                                    }
                                    if (matches.length === 0) {
                                      return <CommandEmpty>No se encontraron clientes ERP.</CommandEmpty>;
                                    }
                                    return (
                                      <CommandGroup>
                                        {matches.map(c => (
                                          <CommandItem
                                            key={c.id}
                                            value={c.id}
                                            onSelect={() => {
                                              setStatusUpdate({ ...statusUpdate, erpClientId: c.id });
                                              setIsErpClientSearchOpen(false);
                                            }}
                                          >
                                            <div className="flex flex-col">
                                              <span className="text-xs font-mono text-slate-500">{c.id}</span>
                                              <span className="text-sm font-medium">{c.tradeName || c.company}</span>
                                              {c.tradeName && <span className="text-[10px] text-slate-400">{c.company}</span>}
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    );
                                  })()}
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                  )}

                  {statusUpdate.status === "RECHAZADO" && (
                    <div className="grid gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                      <label className="text-xs font-bold text-red-700 flex items-center gap-2">
                        <XCircle className="w-3 h-3" />
                        Motivo del Rechazo
                      </label>
                      <Select
                        value={statusUpdate.rechazoMotivoId ? String(statusUpdate.rechazoMotivoId) : ""}
                        onValueChange={(val) => setStatusUpdate({ ...statusUpdate, rechazoMotivoId: Number(val) })}
                      >
                        <SelectTrigger className="bg-white border-red-200 focus-visible:ring-red-500 h-8 text-sm">
                          <SelectValue placeholder="Seleccionar motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          {rechazoMotivos.map(m => (
                            <SelectItem key={m.id} value={String(m.id)}>{m.descripcion}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid gap-2">
                    <label className="text-sm font-semibold text-brand-navy flex items-center gap-2">
                      <Paperclip className="w-3 h-3" />
                      URL de Evidencia (Opcional)
                    </label>
                    <Input 
                      placeholder="https://example.com/evidencia.pdf" 
                      value={statusUpdate.evidenceUrl}
                      onChange={(e) => setStatusUpdate({...statusUpdate, evidenceUrl: e.target.value})}
                      className="bg-white h-8 text-sm"
                    />
                  </div>
                </div>
                <DialogFooter className="p-6 bg-white border-t flex items-center justify-between sm:justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setIsStatusUpdateOpen(false)}>Cancelar</Button>
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange(
                      selectedLead!.id,
                      statusUpdate.status as LeadStatus,
                      statusUpdate.comment,
                      statusUpdate.evidenceUrl,
                      statusUpdate.quotedAmount,
                      statusUpdate.invoicedAmount,
                      statusUpdate.rechazoMotivoId || undefined,
                      statusUpdate.erpClientId || undefined
                    )}
                    disabled={
                      !statusUpdate.comment ||
                      (statusUpdate.status === "RECHAZADO" && !statusUpdate.rechazoMotivoId) ||
                      (statusUpdate.status === "FACTURADO" && selectedLead != null && isCrmClientId(selectedLead.clientId) && !statusUpdate.erpClientId)
                    }
                    className="gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirmar Actualización
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



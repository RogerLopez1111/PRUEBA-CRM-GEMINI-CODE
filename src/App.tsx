/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  AlertTriangle,
  Plus,
  Filter,
  BarChart3,
  LayoutDashboard,
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
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Lead, User, LeadStatus } from "./types";
import { motion, AnimatePresence } from "motion/react";
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

const SUCURSALES = ["CDMX", "Jalisco", "Nuevo León", "Querétaro", "Puebla", "Yucatán", "Baja California"];
const SEGMENTOS = [
  "SIN SEGMENTO",
  "AUTOCONTROL",
  "CONTROLADORES DE PLAGAS",
  "DISTRIBUIDORES",
  "GRANOS ALMACENADOS",
  "MOSTRADOR",
  "ESPECIALES",
  "CLIENTES INCOBRABLES",
  "GOBIERNO MUNICIPAL",
  "VENTAS POR SERVICIOS",
  "VENTA DE ACTIVOS",
  "MAYORISTAS ABARROTEROS",
  "VENTAS EN LINEA",
  "GOBIERNO ESTATAL"
];

function KanbanColumn({ status, leads, users, onUpdate, getStatusBadge }: { key?: string, status: LeadStatus, leads: Lead[], users: User[], onUpdate: (lead: Lead, newStatus?: LeadStatus) => void, getStatusBadge: (status: LeadStatus) => React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div key={status} className="flex-shrink-0 w-80 flex flex-col gap-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">{status}</h3>
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
          className="flex-1 bg-slate-100/50 rounded-xl p-2 space-y-3 border border-dashed border-slate-200 min-h-[200px]"
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

function SortableLeadCard({ lead, users, onUpdate, getStatusBadge }: { key?: string, lead: Lead, users: User[], onUpdate: () => void, getStatusBadge: (status: LeadStatus) => React.ReactNode }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 cursor-grab active:cursor-grabbing group relative"
    >
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-bold text-sm group-hover:text-primary transition-colors">{lead.name}</h4>
        <span className="text-[10px] font-mono font-bold text-slate-400">${lead.value.toLocaleString()}</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{lead.company}</p>
      
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
        <div className="flex items-center gap-2">
          {lead.assignedTo ? (
            <div className="w-6 h-6 rounded-full bg-primary/10 border-2 border-white flex items-center justify-center text-[8px] font-bold text-primary" title={users.find(u => u.id === lead.assignedTo)?.name}>
              {users.find(u => u.id === lead.assignedTo)?.name.charAt(0)}
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] text-slate-400">
              ?
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon-xs" 
            className="h-6 w-6 rounded-full hover:bg-slate-100" 
            title="View Timeline"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate();
            }}
          >
            <History className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon-xs" 
            className="h-6 w-6 rounded-full hover:bg-slate-100" 
            onClick={(e) => {
              e.stopPropagation();
              onUpdate();
            }}
            title="Update Status"
          >
            <MessageSquare className="w-3 h-3" />
          </Button>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock className="w-3 h-3" />
            <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isNewUserOpen, setIsNewUserOpen] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", email: "", company: "", value: 0, sucursal: SUCURSALES[0], segmento: SEGMENTOS[0] });
  const [newUser, setNewUser] = useState({ name: "", email: "", role: "Seller" as "Admin" | "Seller", salesGoal: 50000 });
  const [loginEmail, setLoginEmail] = useState("");
  const [isStatusUpdateOpen, setIsStatusUpdateOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [statusUpdate, setStatusUpdate] = useState({ 
    status: "" as LeadStatus, 
    comment: "", 
    evidenceUrl: "",
    quotedAmount: 0,
    invoicedAmount: 0
  });

  // Admin Hub Filters
  const [adminFilterSeller, setAdminFilterSeller] = useState<string>("all");
  const [adminFilterStatus, setAdminFilterStatus] = useState<string>("all");
  const [adminFilterSucursal, setAdminFilterSucursal] = useState<string>("all");
  const [adminFilterSegmento, setAdminFilterSegmento] = useState<string>("all");
  const [adminSearch, setAdminSearch] = useState("");

  // Kanban Filters
  const [kanbanFilterSeller, setKanbanFilterSeller] = useState<string>("all");
  const [kanbanFilterSucursal, setKanbanFilterSucursal] = useState<string>("all");
  const [kanbanFilterSegmento, setKanbanFilterSegmento] = useState<string>("all");
  const [kanbanSearch, setKanbanSearch] = useState("");

  // Performance Filters
  const [perfUserFilter, setPerfUserFilter] = useState<string>("all");

  // Admin Sub-tabs
  const [adminSubTab, setAdminSubTab] = useState<string>("users");

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

  useEffect(() => {
    const savedUser = localStorage.getItem("leadflow_user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      if (user.role === "Seller") setPerfUserFilter(user.id);
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [leadsRes, usersRes] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/users")
      ]);
      const leadsData = await leadsRes.json();
      const usersData = await usersRes.json();
      setLeads(leadsData);
      setUsers(usersData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail })
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        if (user.role === "Seller") setPerfUserFilter(user.id);
        else setPerfUserFilter("all");
        localStorage.setItem("leadflow_user", JSON.stringify(user));
        toast.success(`Welcome back, ${user.name}`);
      } else {
        toast.error("Invalid email address");
      }
    } catch (error) {
      toast.error("Login failed");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("leadflow_user");
    toast.info("Logged out successfully");
  };

  const handleAssign = async (leadId: string, userId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });
      if (res.ok) {
        toast.success("Lead assigned successfully");
        fetchData();
      }
    } catch (error) {
      toast.error("Failed to assign lead");
    }
  };

  const handleStatusChange = async (
    leadId: string, 
    status: LeadStatus, 
    comment?: string, 
    evidenceUrl?: string,
    quotedAmount?: number,
    invoicedAmount?: number
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
          userId: currentUser?.id 
        })
      });
      if (res.ok) {
        toast.success(`Lead marked as ${status}`);
        setIsStatusUpdateOpen(false);
        setStatusUpdate({ 
          status: "" as LeadStatus, 
          comment: "", 
          evidenceUrl: "",
          quotedAmount: 0,
          invoicedAmount: 0
        });
        fetchData();
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const openStatusUpdate = (lead: Lead, newStatus?: LeadStatus) => {
    setSelectedLead(lead);
    setStatusUpdate({ 
      status: newStatus || lead.status, 
      comment: "", 
      evidenceUrl: "",
      quotedAmount: lead.quotedAmount || 0,
      invoicedAmount: lead.invoicedAmount || 0
    });
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
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...newLead, 
          userId: currentUser?.role === "Seller" ? currentUser.id : undefined 
        })
      });
      if (res.ok) {
        toast.success(currentUser?.role === "Seller" ? "Lead created and assigned to you" : "New lead created");
        setIsNewLeadOpen(false);
        setNewLead({ 
          name: "", 
          email: "", 
          company: "", 
          value: 0, 
          sucursal: SUCURSALES[0], 
          segmento: SEGMENTOS[0] 
        });
        fetchData();
      }
    } catch (error) {
      toast.error("Failed to create lead");
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
        toast.success("User role updated");
        fetchData();
      }
    } catch (error) {
      toast.error("Failed to update role");
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
        toast.success("Sales goal updated");
        fetchData();
      }
    } catch (error) {
      toast.error("Failed to update goal");
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
        toast.success("New user created successfully");
        setIsNewUserOpen(false);
        setNewUser({ name: "", email: "", role: "Seller", salesGoal: 50000 });
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create user");
      }
    } catch (error) {
      toast.error("Failed to create user");
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
    const diffInMs = now - lastUpdate;
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours > 72) return "critical"; // More than 3 days
    if (diffInHours > 24) return "warning"; // More than 1 day
    return "normal";
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Toaster position="top-right" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-none shadow-xl bg-white">
            <CardHeader className="text-center space-y-1">
              <div className="flex justify-center mb-4">
                <div className="bg-primary p-3 rounded-2xl shadow-lg shadow-primary/20">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">LeadFlow CRM</CardTitle>
              <CardDescription>Enter your email to access your sales dashboard</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 ml-1">Email Address</label>
                    <Input 
                      type="email" 
                      placeholder="name@leadflow.com" 
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                      className="h-12"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 text-center">
                    Try: admin@leadflow.com or alice@leadflow.com
                  </p>
                </div>
                <Button type="submit" className="w-full h-12 gap-2 text-base font-semibold">
                  <LogIn className="w-5 h-5" />
                  Sign In
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary/20 rounded-full" />
          <p className="text-slate-500 font-medium">Loading LeadFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 font-sans text-slate-900">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">LeadFlow <span className="text-primary">CRM</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-semibold">{currentUser.name}</span>
              <span className="text-xs text-slate-500">{currentUser.role}</span>
            </div>
            <Dialog>
              <DialogTrigger nativeButton={false} render={
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center border-2 border-white shadow-sm cursor-pointer hover:bg-slate-300 transition-colors">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
              } />
              <DialogContent className="sm:max-w-[300px]">
                <DialogHeader>
                  <DialogTitle>Account</DialogTitle>
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
                    Sign Out
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue={currentUser.role === "Admin" ? "leads" : "my-leads"} className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList className="bg-white border shadow-sm p-1 h-12">
              {currentUser.role === "Admin" && (
                <TabsTrigger value="leads" className="gap-2 px-6">
                  <LayoutDashboard className="w-4 h-4" />
                  All Leads
                </TabsTrigger>
              )}
              <TabsTrigger value="my-leads" className="gap-2 px-6">
                <UserCheck className="w-4 h-4" />
                My Leads
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2 px-6">
                <Kanban className="w-4 h-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="performance" className="gap-2 px-6">
                <BarChart3 className="w-4 h-4" />
                Performance
              </TabsTrigger>
              {currentUser.role === "Admin" && (
                <TabsTrigger value="admin" className="gap-2 px-6">
                  <ShieldCheck className="w-4 h-4" />
                  Admin Hub
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex items-center gap-2">
              <Dialog open={isNewLeadOpen} onOpenChange={setIsNewLeadOpen}>
                <DialogTrigger nativeButton={true} render={<Button className="gap-2 shadow-sm" />}>
                  <Plus className="w-4 h-4" />
                  New Lead
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Lead</DialogTitle>
                    <DialogDescription>Enter the details of the potential customer.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Name</label>
                      <Input 
                        placeholder="John Doe" 
                        value={newLead.name}
                        onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Email</label>
                      <Input 
                        placeholder="john@example.com" 
                        value={newLead.email}
                        onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Company</label>
                      <Input 
                        placeholder="TechCorp" 
                        value={newLead.company}
                        onChange={(e) => setNewLead({...newLead, company: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Potential Value ($)</label>
                      <Input 
                        type="number" 
                        placeholder="5000" 
                        value={newLead.value}
                        onChange={(e) => setNewLead({...newLead, value: Number(e.target.value)})}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Sucursal</label>
                        <Select value={newLead.sucursal} onValueChange={(val) => setNewLead({...newLead, sucursal: val})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Sucursal" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUCURSALES.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium">Segmento</label>
                        <Select value={newLead.segmento} onValueChange={(val) => setNewLead({...newLead, segmento: val})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Segmento" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEGMENTOS.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNewLeadOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateLead}>Create Lead</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {currentUser.role === "Admin" && (
            <TabsContent value="leads" className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Total Leads</p>
                        <h3 className="text-2xl font-bold">{leads.length}</h3>
                      </div>
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">New Leads</p>
                        <h3 className="text-2xl font-bold">{leads.filter(l => l.status === "New").length}</h3>
                      </div>
                      <div className="bg-orange-50 p-2 rounded-lg">
                        <Clock className="w-5 h-5 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Closed Deals</p>
                        <h3 className="text-2xl font-bold">{leads.filter(l => l.status === "Closed").length}</h3>
                      </div>
                      <div className="bg-green-50 p-2 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Total Pipeline</p>
                        <h3 className="text-2xl font-bold">${leads.reduce((acc, l) => acc + l.value, 0).toLocaleString()}</h3>
                      </div>
                      <div className="bg-indigo-50 p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Leads Table */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-white border-b py-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold">Recent Leads</CardTitle>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-1 min-w-[200px] space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Search</p>
                        <Input 
                          placeholder="Search by name or company..." 
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Seller</p>
                        <Select value={adminFilterSeller} onValueChange={setAdminFilterSeller}>
                          <SelectTrigger className="w-[150px] h-9">
                            <SelectValue placeholder="All Sellers" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sellers</SelectItem>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {users.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Status</p>
                        <Select value={adminFilterStatus} onValueChange={setAdminFilterStatus}>
                          <SelectTrigger className="w-[150px] h-9">
                            <SelectValue placeholder="All Statuses" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
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
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Sucursal</p>
                        <Select value={adminFilterSucursal} onValueChange={setAdminFilterSucursal}>
                          <SelectTrigger className="w-[150px] h-9">
                            <SelectValue placeholder="All Sucursales" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sucursales</SelectItem>
                            {SUCURSALES.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Segmento</p>
                        <Select value={adminFilterSegmento} onValueChange={setAdminFilterSegmento}>
                          <SelectTrigger className="w-[150px] h-9">
                            <SelectValue placeholder="All Segmentos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Segmentos</SelectItem>
                            {SEGMENTOS.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="font-semibold">Lead</TableHead>
                        <TableHead className="font-semibold">Company</TableHead>
                        <TableHead className="font-semibold">Sucursal</TableHead>
                        <TableHead className="font-semibold">Segmento</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Assigned To</TableHead>
                        <TableHead className="font-semibold">Value</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {leads
                          .filter(l => {
                            if (adminFilterSeller !== "all") {
                              if (adminFilterSeller === "unassigned") {
                                if (l.assignedTo) return false;
                              } else if (l.assignedTo !== adminFilterSeller) {
                                return false;
                              }
                            }
                            if (adminFilterStatus !== "all" && l.status !== adminFilterStatus) return false;
                            if (adminFilterSucursal !== "all" && l.sucursal !== adminFilterSucursal) return false;
                            if (adminFilterSegmento !== "all" && l.segmento !== adminFilterSegmento) return false;
                            if (adminSearch && !l.name.toLowerCase().includes(adminSearch.toLowerCase()) && !l.company.toLowerCase().includes(adminSearch.toLowerCase())) return false;
                            return true;
                          })
                          .map((lead) => (
                          <motion.tr 
                            key={lead.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="group hover:bg-slate-50/50 transition-colors"
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{lead.name}</span>
                                <span className="text-xs text-slate-500">{lead.email}</span>
                              </div>
                            </TableCell>
                            <TableCell>{lead.company}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-normal">{lead.sucursal}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-normal">{lead.segmento}</Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(lead.status)}</TableCell>
                            <TableCell>
                              {lead.assignedTo ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                    {users.find(u => u.id === lead.assignedTo)?.name.charAt(0)}
                                  </div>
                                  <span className="text-sm">{users.find(u => u.id === lead.assignedTo)?.name}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm font-medium">
                              ${lead.value.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!lead.assignedTo && (
                                  <Select onValueChange={(val: string) => handleAssign(lead.id, val)}>
                                    <SelectTrigger className="w-[140px] h-8">
                                      <SelectValue placeholder="Assign to..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {users.map(user => (
                                        <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="my-leads" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">My Active Leads</h2>
                <p className="text-slate-500">Manage and update the status of leads assigned to you.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {leads.filter(l => l.assignedTo === currentUser.id).length === 0 ? (
                <Card className="border-dashed border-2 bg-transparent">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                    <p>No leads assigned to you yet.</p>
                  </CardContent>
                </Card>
              ) : (
                leads.filter(l => l.assignedTo === currentUser.id).map((lead) => (
                  <Card key={lead.id} className="border-none shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-6">
                        <div className="flex items-start gap-4">
                          <div className="bg-slate-100 p-3 rounded-full">
                            <Users className="w-6 h-6 text-slate-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-lg">{lead.name}</h3>
                              {getStatusBadge(lead.status)}
                            </div>
                            <p className="text-slate-500 text-sm">{lead.company} • {lead.email}</p>
                            <p className="text-primary font-mono font-bold mt-2">${lead.value.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          <div className="w-full sm:w-auto">
                            <p className="text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Update Status</p>
                            <Select 
                              value={lead.status} 
                              onValueChange={(val) => openStatusUpdate(lead, val as LeadStatus)}
                            >
                              <SelectTrigger className="w-full sm:w-[180px]">
                                <SelectValue placeholder="Change status" />
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
                            <History className="w-4 h-4" /> Timeline
                          </Button>
                        </div>
                      </div>
                      <div className="bg-slate-50 px-6 py-3 flex items-center justify-between border-t">
                        <span className="text-xs text-slate-400">Last updated: {new Date(lead.updatedAt).toLocaleDateString()}</span>
                        <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>Active for {Math.floor((new Date().getTime() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days</span>
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
                <h2 className="text-2xl font-bold tracking-tight">Sales Pipeline</h2>
                <p className="text-slate-500">Visual overview of all active leads across the pipeline.</p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="relative w-full md:w-64 space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Search Leads</p>
                  <div className="relative">
                    <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input 
                      placeholder="Search leads..." 
                      className="pl-9 h-9"
                      value={kanbanSearch}
                      onChange={(e) => setKanbanSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Sucursal</p>
                  <Select value={kanbanFilterSucursal} onValueChange={setKanbanFilterSucursal}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="All Sucursales" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sucursales</SelectItem>
                      {SUCURSALES.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Segmento</p>
                  <Select value={kanbanFilterSegmento} onValueChange={setKanbanFilterSegmento}>
                    <SelectTrigger className="w-[150px] h-9">
                      <SelectValue placeholder="All Segmentos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Segmentos</SelectItem>
                      {SEGMENTOS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {currentUser.role === "Admin" && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Seller</p>
                    <Select value={kanbanFilterSeller} onValueChange={setKanbanFilterSeller}>
                      <SelectTrigger className="w-[150px] h-9">
                        <SelectValue placeholder="All Sellers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sellers</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {users.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
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

                      return true;
                    })}
                    users={users}
                    onUpdate={openStatusUpdate}
                    getStatusBadge={getStatusBadge}
                  />
                ))}
                <DragOverlay>
                  {activeId ? (
                    <div className="bg-white p-4 rounded-lg shadow-xl border-2 border-primary/20 w-80 opacity-90 rotate-2">
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
                <h2 className="text-2xl font-bold tracking-tight">Performance Analytics</h2>
                <p className="text-slate-500">
                  {currentUser.role === "Admin" 
                    ? "Team-wide sales performance and pipeline health." 
                    : "Your personal sales metrics and pipeline progress."}
                </p>
              </div>

              {currentUser.role === "Admin" && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Filter by Seller</p>
                  <Select value={perfUserFilter} onValueChange={setPerfUserFilter}>
                    <SelectTrigger className="w-[200px] h-10">
                      <SelectValue placeholder="Select View" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Team Overview</SelectItem>
                      {users.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {currentUser.role === "Admin" && perfUserFilter === "all" ? (
              <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader>
                  <CardTitle>Team Performance Summary</CardTitle>
                  <CardDescription>Overview of all sellers and their current pipeline status.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/50">
                        <TableHead className="font-semibold">Seller</TableHead>
                        <TableHead className="font-semibold">Vendido ($)</TableHead>
                        <TableHead className="font-semibold">Cotizado ($)</TableHead>
                        <TableHead className="font-semibold">Perdido ($)</TableHead>
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

                  return (
                    <div key={user.id} className="lg:col-span-3 space-y-6">
                      {/* Summary Scorecard */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="border-none shadow-sm bg-white">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                              <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Vendido</p>
                              <p className="text-xl font-bold text-green-600">${soldValue.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">{soldCount} deals closed</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-white">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                              <FileText className="w-6 h-6 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Cotizado</p>
                              <p className="text-xl font-bold text-amber-600">${quotedValue.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">{quotedCount} active quotes</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-white">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                              <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Perdido</p>
                              <p className="text-xl font-bold text-red-600">${lostValue.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">{lostCount} deals lost</p>
                            </div>
                          </CardContent>
                        </Card>
                        <Card className="border-none shadow-sm bg-white">
                          <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center">
                              <TrendingUp className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Meta de Ventas</p>
                              <p className="text-xl font-bold text-slate-900">${user.performance.salesGoal.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400">{Math.min(100, Math.round((soldValue / user.performance.salesGoal) * 100))}% achieved</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="border-none shadow-sm bg-white overflow-hidden lg:col-span-1">
                          <div className="h-2 bg-primary w-full opacity-20" />
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center border">
                                  <UserCheck className="w-5 h-5 text-slate-600" />
                                </div>
                                <div>
                                  <CardTitle className="text-base">{user.name}</CardTitle>
                                  <CardDescription>{user.role}</CardDescription>
                                </div>
                              </div>
                              {soldValue >= user.performance.salesGoal && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Goal Met</Badge>
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
                          </CardContent>
                        </Card>

                    <Card className="border-none shadow-sm bg-white lg:col-span-1">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Distribución de Pipeline ($)</CardTitle>
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
                            <p className="text-xs italic">No data to visualize</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white lg:col-span-1">
                      <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">Motivos de Rechazo</CardTitle>
                        <CardDescription className="text-[10px]">Latest comments from lost deals.</CardDescription>
                      </CardHeader>
                      <CardContent className="max-h-[250px] overflow-y-auto space-y-3">
                        {lostLeads.length > 0 ? (
                          lostLeads.map(lead => {
                            const lastComment = lead.history.filter(h => h.status === "RECHAZADO").pop()?.comment;
                            return (
                              <div key={lead.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="flex justify-between items-start mb-1">
                                  <p className="text-xs font-bold text-slate-700">{lead.company}</p>
                                  <span className="text-[10px] font-mono text-slate-400">${lead.value.toLocaleString()}</span>
                                </div>
                                <p className="text-xs text-slate-500 italic">"{lastComment || "No reason provided"}"</p>
                              </div>
                            );
                          })
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2 py-12">
                            <TrendingUp className="w-8 h-8 opacity-20" />
                            <p className="text-xs italic">No lost deals yet</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </TabsContent>

          {currentUser.role === "Admin" && (
            <TabsContent value="admin" className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Administration Hub</h2>
                  <p className="text-slate-500">Manage user roles, goals, and oversee team workload.</p>
                </div>
                <Tabs value={adminSubTab} onValueChange={setAdminSubTab} className="w-full md:w-auto">
                  <TabsList className="bg-slate-100/50 p-1">
                    <TabsTrigger value="users" className="text-xs px-4">Users</TabsTrigger>
                    <TabsTrigger value="workload" className="text-xs px-4">Workload</TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs px-4">Global Activity</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid grid-cols-1 gap-8">
                {adminSubTab === "users" && (
                  <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Settings className="w-5 h-5 text-slate-400" />
                            User Management
                          </CardTitle>
                          <CardDescription>Assign roles and set individual sales targets.</CardDescription>
                        </div>
                        <Dialog open={isNewUserOpen} onOpenChange={setIsNewUserOpen}>
                          <DialogTrigger render={<Button className="gap-2" />}>
                            <UserPlus className="w-4 h-4" />
                            Add User
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Add New Team Member</DialogTitle>
                              <DialogDescription>Create a new user account for the CRM.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Full Name</label>
                                <Input 
                                  placeholder="John Doe" 
                                  value={newUser.name}
                                  onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">Email Address</label>
                                <Input 
                                  type="email"
                                  placeholder="john@leadflow.com" 
                                  value={newUser.email}
                                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                  <label className="text-sm font-medium">Role</label>
                                  <Select 
                                    value={newUser.role} 
                                    onValueChange={(val) => setNewUser({...newUser, role: val as "Admin" | "Seller"})}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Admin">Admin</SelectItem>
                                      <SelectItem value="Seller">Seller</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <label className="text-sm font-medium">Sales Goal ($)</label>
                                  <Input 
                                    type="number"
                                    value={newUser.salesGoal}
                                    onChange={(e) => setNewUser({...newUser, salesGoal: Number(e.target.value)})}
                                  />
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setIsNewUserOpen(false)}>Cancel</Button>
                              <Button onClick={handleCreateUser} disabled={!newUser.name || !newUser.email}>Create User</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="font-semibold">User</TableHead>
                            <TableHead className="font-semibold">Role</TableHead>
                            <TableHead className="font-semibold">Workload</TableHead>
                            <TableHead className="font-semibold">Pipeline Value</TableHead>
                            <TableHead className="font-semibold">Sales Goal ($)</TableHead>
                            <TableHead className="text-right font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {users.map((user) => (
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
                                    <SelectItem value="Seller">Seller</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1.5 w-32">
                                  <div className="flex justify-between text-[10px] font-bold">
                                    <span>{user.workload?.activeLeads || 0} Leads</span>
                                    <span className={
                                      (user.workload?.activeLeads || 0) > 10 ? "text-red-500" : 
                                      (user.workload?.activeLeads || 0) > 5 ? "text-orange-500" : "text-green-500"
                                    }>
                                      {(user.workload?.activeLeads || 0) > 10 ? "High" : 
                                       (user.workload?.activeLeads || 0) > 5 ? "Medium" : "Low"}
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${
                                        (user.workload?.activeLeads || 0) > 10 ? "bg-red-500" : 
                                        (user.workload?.activeLeads || 0) > 5 ? "bg-orange-500" : "bg-green-500"
                                      }`}
                                      style={{ width: `${Math.min(((user.workload?.activeLeads || 0) / 15) * 100, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                ${(user.workload?.pipelineValue || 0).toLocaleString()}
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
                                <Button variant="ghost" size="sm" className="h-8">View Details</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {adminSubTab === "workload" && (
                  <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-slate-400" />
                        Team Workload Oversight
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Search</p>
                          <div className="relative w-full md:w-64">
                            <Filter className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                              placeholder="Search leads or companies..." 
                              className="pl-9 h-9"
                              value={adminSearch}
                              onChange={(e) => setAdminSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Seller</p>
                          <Select value={adminFilterSeller} onValueChange={setAdminFilterSeller}>
                            <SelectTrigger className="w-[150px] h-9">
                              <SelectValue placeholder="All Sellers" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Sellers</SelectItem>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {users.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400 uppercase ml-1">Status</p>
                          <Select value={adminFilterStatus} onValueChange={setAdminFilterStatus}>
                            <SelectTrigger className="w-[150px] h-9">
                              <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
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
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {leads
                        .filter(l => {
                          const matchesSeller = adminFilterSeller === "all" || 
                                              (adminFilterSeller === "unassigned" && !l.assignedTo) || 
                                              l.assignedTo === adminFilterSeller;
                          const matchesStatus = adminFilterStatus === "all" || l.status === adminFilterStatus;
                          const matchesSearch = l.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
                                              l.company.toLowerCase().includes(adminSearch.toLowerCase());
                          return matchesSeller && matchesStatus && matchesSearch;
                        })
                        .map((lead) => {
                          const stuckLevel = getStuckLevel(lead.updatedAt);
                          return (
                            <Card key={lead.id} className={cn(
                              "border-none shadow-sm bg-white hover:ring-1 hover:ring-primary/20 transition-all cursor-pointer relative overflow-hidden",
                              stuckLevel === "critical" && "ring-1 ring-red-200 bg-red-50/10",
                              stuckLevel === "warning" && "ring-1 ring-orange-200 bg-orange-50/10"
                            )} onClick={() => openStatusUpdate(lead)}>
                              {stuckLevel !== "normal" && (
                                <div className={cn(
                                  "absolute top-0 right-0 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white rounded-bl-lg",
                                  stuckLevel === "critical" ? "bg-red-500" : "bg-orange-500"
                                )}>
                                  {stuckLevel === "critical" ? "Critical Delay" : "Delayed"}
                                </div>
                              )}
                              <CardHeader className="p-4 pb-2">
                                <div className="flex items-center justify-between mb-1">
                                  {getStatusBadge(lead.status)}
                                  <span className="text-[10px] font-bold text-slate-400 uppercase">ID: {lead.id}</span>
                                </div>
                                <CardTitle className="text-base font-bold">{lead.name}</CardTitle>
                                <CardDescription className="text-xs">{lead.company}</CardDescription>
                              </CardHeader>
                              <CardContent className="p-4 pt-2 space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-slate-500">Value</span>
                                  <span className="text-sm font-mono font-bold text-primary">${lead.value.toLocaleString()}</span>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-slate-50">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold">
                                        {lead.assignedTo ? users.find(u => u.id === lead.assignedTo)?.name.charAt(0) : "?"}
                                      </div>
                                      <span className="text-xs text-slate-600">
                                        {lead.assignedTo ? users.find(u => u.id === lead.assignedTo)?.name : "Unassigned"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                      <Clock className="w-3 h-3" />
                                      <span>{new Date(lead.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between bg-slate-50/50 p-2 rounded-lg">
                                    <span className="text-[10px] font-medium text-slate-500">Tiempo de la última actualización:</span>
                                    <div className="flex items-center gap-1">
                                      {stuckLevel !== "normal" && <AlertTriangle className={cn("w-3 h-3", stuckLevel === "critical" ? "text-red-500" : "text-orange-500")} />}
                                      <span className={cn(
                                        "text-[10px] font-bold",
                                        stuckLevel === "critical" ? "text-red-600" : 
                                        stuckLevel === "warning" ? "text-orange-600" : "text-slate-600"
                                      )}>
                                        {getTimeStuck(lead.updatedAt)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      {leads.filter(l => {
                          const matchesSeller = adminFilterSeller === "all" || 
                                              (adminFilterSeller === "unassigned" && !l.assignedTo) || 
                                              l.assignedTo === adminFilterSeller;
                          const matchesStatus = adminFilterStatus === "all" || l.status === adminFilterStatus;
                          const matchesSearch = l.name.toLowerCase().includes(adminSearch.toLowerCase()) || 
                                              l.company.toLowerCase().includes(adminSearch.toLowerCase());
                          return matchesSeller && matchesStatus && matchesSearch;
                        }).length === 0 && (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 bg-white rounded-xl border-2 border-dashed border-slate-100">
                          <Filter className="w-8 h-8 mb-2 opacity-20" />
                          <p className="text-sm">No leads match your current filters.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {adminSubTab === "activity" && (
                  <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <History className="w-5 h-5 text-slate-400" />
                            Global Activity Timeline
                          </CardTitle>
                          <CardDescription>A complete history of all updates across the team.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select value={adminFilterSeller} onValueChange={setAdminFilterSeller}>
                            <SelectTrigger className="w-[150px] h-8 text-xs">
                              <SelectValue placeholder="Filter by Seller" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Sellers</SelectItem>
                              {users.map(u => (
                                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="font-semibold">Seller</TableHead>
                            <TableHead className="font-semibold">Lead / Company</TableHead>
                            <TableHead className="font-semibold">Update</TableHead>
                            <TableHead className="font-semibold">Comment</TableHead>
                            <TableHead className="font-semibold">Amount</TableHead>
                            <TableHead className="text-right font-semibold">Date</TableHead>
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
                                      {users.find(u => u.id === update.updatedBy)?.name || "System"}
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
                                No activity recorded yet.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
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
            <div className="w-full md:w-1/2 border-r border-slate-100 flex flex-col">
              <DialogHeader className="p-6 pb-2">
                <DialogTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-primary" />
                  Historial: {selectedLead?.name}
                </DialogTitle>
                <DialogDescription>
                  Timeline of all status changes and comments.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto p-6 pt-4">
                <div className="relative border-l-2 border-slate-100 ml-3 space-y-8">
                  {!selectedLead || selectedLead.history.length === 0 ? (
                    <p className="text-center text-slate-400 italic py-8">No history recorded yet.</p>
                  ) : (
                    [...selectedLead.history].reverse().map((item) => (
                      <div key={item.id} className="relative pl-8">
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-primary" />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusBadge(item.status)}
                              <span className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-500 uppercase">by {users.find(u => u.id === item.updatedBy)?.name || "System"}</span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1">{item.comment}</p>
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
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Side: Update Form */}
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nuevo Estado</label>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
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
                      value={statusUpdate.quotedAmount}
                      onChange={(e) => setStatusUpdate({...statusUpdate, quotedAmount: Number(e.target.value)})}
                      className="bg-white border-orange-200 focus-visible:ring-orange-500 h-8 text-sm"
                    />
                  </div>
                )}

                {statusUpdate.status === "FACTURADO" && (
                  <div className="grid gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                    <label className="text-xs font-bold text-indigo-700 flex items-center gap-2">
                      <FileText className="w-3 h-3" />
                      Monto Facturado ($)
                    </label>
                    <Input 
                      type="number"
                      placeholder="0.00" 
                      value={statusUpdate.invoicedAmount}
                      onChange={(e) => setStatusUpdate({...statusUpdate, invoicedAmount: Number(e.target.value)})}
                      className="bg-white border-indigo-200 focus-visible:ring-indigo-500 h-8 text-sm"
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
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
                    statusUpdate.invoicedAmount
                  )}
                  disabled={!statusUpdate.comment}
                  className="gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmar Actualización
                </Button>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}



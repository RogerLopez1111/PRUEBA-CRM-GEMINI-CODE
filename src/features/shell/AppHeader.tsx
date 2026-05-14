/**
 * App header — logo, current user, notifications popover (stale leads), and
 * account/logout dialog. Notifications cards open the status-update dialog
 * so the host App's ref-callback flows through here as a prop.
 */
import { useMemo } from "react";
import { Bell, LogOut, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";
import { useAppData } from "../../state/AppDataContext";
import type { Lead, LeadStatus } from "../../types";

interface AppHeaderProps {
  openStatusUpdate: (lead: Lead, newStatus?: LeadStatus) => void;
}

interface Notification {
  id: string;
  leadId: string;
  kind: "stale-assignment" | "stale-quote";
  lead: Lead;
  days: number;
  sellerName: string;
}

export function AppHeader({ openStatusUpdate }: AppHeaderProps) {
  const { leads, users, currentUser, setCurrentUser } = useAppData();

  const notifications = useMemo<Notification[]>(() => {
    if (!currentUser) return [];
    const now = Date.now();
    const DAY = 1000 * 60 * 60 * 24;
    const visible = currentUser.role === "Admin"
      ? leads
      : leads.filter(l => l.assignedTo === currentUser.id);
    const out: Notification[] = [];
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

  const handleLogout = () => {
    setCurrentUser(null);
    toast.info("Sesión cerrada exitosamente");
  };

  if (!currentUser) return null;

  return (
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
                          <p className="text-xs mt-1" style={{ color: "#141456" }}>
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
  );
}

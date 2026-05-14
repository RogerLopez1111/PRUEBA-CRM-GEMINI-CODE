import { Badge } from "@/components/ui/badge";
import type { LeadStatus } from "../../types";

export function getStatusBadge(status: LeadStatus) {
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
}

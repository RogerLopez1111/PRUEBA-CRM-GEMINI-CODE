/**
 * AppDataContext — single source of truth for server-derived CRM data + the
 * authenticated user. Created during Phase 2 of the App.tsx split so future
 * feature folders can call useAppData() instead of having state passed down.
 *
 * Component-local state (filters, dialogs, forms) does NOT live here — it
 * stays inside the tab/feature that owns it.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type {
  Lead,
  User,
  Client,
  Product,
  ProductoFaltante,
  PedidoExtraordinario,
  Tarea,
} from "../types";
import { AUTH_EXPIRED_EVENT, apiFetch, getStoredToken, setStoredToken } from "../lib/api";

interface AppData {
  // Server data
  leads: Lead[];
  users: User[];
  clients: Client[];
  sucursales: { id: string; name: string }[];
  segmentos: { id: string; name: string }[];
  productos: Product[];
  faltantes: ProductoFaltante[];
  pedidos: PedidoExtraordinario[];
  tareas: Tarea[];
  rechazoMotivos: { id: number; descripcion: string }[];

  // Auth
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;

  // Lifecycle
  loading: boolean;

  // Leads load window: `leadsDesde` is the earliest month start currently loaded
  // (closed leads before it aren't fetched yet); loadOlderLeads walks it back.
  leadsDesde: string;
  loadingOlderLeads: boolean;
  loadOlderLeads: () => Promise<void>;

  // Optimistic cache mutators — patch a single lead in place from a write
  // response (the create/update/delete hot path) instead of refetching the
  // whole dataset. The write endpoints return the authoritative lead row with
  // history, so the UI can update instantly with zero extra round-trips.
  upsertLead: (lead: Lead) => void;
  removeLead: (id: string) => void;

  // Refetchers — granular for the hot paths, refetchAll for everything else
  refetchAll: () => Promise<void>;
  refetchLeads: () => Promise<void>;
  refetchUsers: () => Promise<void>;
  refetchFaltantes: () => Promise<void>;
  refetchPedidos: () => Promise<void>;
  refetchTareas: () => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

const STORAGE_KEY = "ecosistemas_crm_user";

const safeJson = async <T,>(res: Response, fallback: T): Promise<T> => {
  try {
    return res.ok ? await res.json() : fallback;
  } catch {
    return fallback;
  }
};

// Leads are loaded in a rolling time window: open leads always come back, but
// closed (entregado/rechazado) history only from `desde` onward. The default
// window is the current month + the 2 prior (≈3 months); "cargar meses
// anteriores" walks `desde` back CHUNK_MONTHS at a time.
const WINDOW_MONTHS = 3;
const CHUNK_MONTHS = 3;

// First day (YYYY-MM-01) of the month `n` months before the given month start.
function firstOfMonthsBefore(iso: string, n: number): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m - 1 - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function currentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
const DEFAULT_LEADS_DESDE = firstOfMonthsBefore(currentMonthStart(), WINDOW_MONTHS - 1);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sucursales, setSucursales] = useState<{ id: string; name: string }[]>([]);
  const [segmentos, setSegmentos] = useState<{ id: string; name: string }[]>([]);
  const [rechazoMotivos, setRechazoMotivos] = useState<{ id: number; descripcion: string }[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [faltantes, setFaltantes] = useState<ProductoFaltante[]>([]);
  const [pedidos, setPedidos] = useState<PedidoExtraordinario[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [currentUserState, setCurrentUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Rolling window start for the leads load. A ref mirrors it so the stable
  // refetchers read the current value without re-creating their identity.
  const [leadsDesde, setLeadsDesde] = useState<string>(DEFAULT_LEADS_DESDE);
  const [loadingOlderLeads, setLoadingOlderLeads] = useState(false);
  const leadsDesdeRef = useRef(leadsDesde);
  useEffect(() => { leadsDesdeRef.current = leadsDesde; }, [leadsDesde]);

  // Auth setter persists to localStorage so refresh keeps the session.
  // Clearing the user also clears the stored token — they're a unit.
  const setCurrentUser = useCallback((u: User | null) => {
    setCurrentUserState(u);
    try {
      if (u) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setStoredToken(null);
      }
    } catch {
      /* localStorage can throw in private-mode Safari; non-fatal */
    }
  }, []);

  const refetchLeads = useCallback(async () => {
    const res = await apiFetch(`/api/leads?desde=${leadsDesdeRef.current}`);
    setLeads(await safeJson<Lead[]>(res, []));
  }, []);

  // Patch one lead in place (or prepend if new). Keyed by id; a freshly created
  // lead lands at the top of the list where "most recent" belongs.
  const upsertLead = useCallback((lead: Lead) => {
    setLeads((prev) => {
      const i = prev.findIndex((l) => l.id === lead.id);
      if (i === -1) return [lead, ...prev];
      const next = [...prev];
      next[i] = lead;
      return next;
    });
  }, []);

  const removeLead = useCallback((id: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // Extend the window CHUNK_MONTHS further back and reload (the wider window is a
  // superset, so we replace rather than merge). Used by "cargar meses anteriores".
  const loadOlderLeads = useCallback(async () => {
    setLoadingOlderLeads(true);
    const next = firstOfMonthsBefore(leadsDesdeRef.current, CHUNK_MONTHS);
    try {
      const res = await apiFetch(`/api/leads?desde=${next}`);
      const data = await safeJson<Lead[]>(res, []);
      setLeads(data);
      setLeadsDesde(next);
    } finally {
      setLoadingOlderLeads(false);
    }
  }, []);

  const refetchUsers = useCallback(async () => {
    const res = await apiFetch("/api/users");
    setUsers(await safeJson<User[]>(res, []));
  }, []);

  const refetchFaltantes = useCallback(async () => {
    const res = await apiFetch("/api/productos-faltantes");
    setFaltantes(await safeJson<ProductoFaltante[]>(res, []));
  }, []);

  const refetchPedidos = useCallback(async () => {
    const res = await apiFetch("/api/pedidos-extraordinarios");
    setPedidos(await safeJson<PedidoExtraordinario[]>(res, []));
  }, []);

  const refetchTareas = useCallback(async () => {
    const res = await apiFetch("/api/tareas");
    setTareas(await safeJson<Tarea[]>(res, []));
  }, []);

  const refetchAll = useCallback(async () => {
    try {
      const [
        leadsRes, usersRes, clientsRes, sucursalesRes, segmentosRes,
        motivosRes, productosRes, faltantesRes, pedidosRes, tareasRes,
      ] = await Promise.all([
        apiFetch(`/api/leads?desde=${leadsDesdeRef.current}`),
        apiFetch("/api/users"),
        apiFetch("/api/clients"),
        apiFetch("/api/lookups/sucursales"),
        apiFetch("/api/lookups/segmentos"),
        apiFetch("/api/lookups/rechazo-motivos"),
        apiFetch("/api/productos"),
        apiFetch("/api/productos-faltantes"),
        apiFetch("/api/pedidos-extraordinarios"),
        apiFetch("/api/tareas"),
      ]);

      setLeads(await safeJson<Lead[]>(leadsRes, []));
      setUsers(await safeJson<User[]>(usersRes, []));
      setClients(await safeJson<Client[]>(clientsRes, []));
      setSucursales(await safeJson<{ id: string; name: string }[]>(sucursalesRes, []));
      setSegmentos(await safeJson<{ id: string; name: string }[]>(segmentosRes, []));
      setRechazoMotivos(await safeJson<{ id: number; descripcion: string }[]>(motivosRes, []));
      setProductos(await safeJson<Product[]>(productosRes, []));
      setFaltantes(await safeJson<ProductoFaltante[]>(faltantesRes, []));
      setPedidos(await safeJson<PedidoExtraordinario[]>(pedidosRes, []));
      setTareas(await safeJson<Tarea[]>(tareasRes, []));
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial mount: if we have a token, rehydrate currentUser from /api/me
  // (don't trust the localStorage user record on its own — token is the
  // source of truth). Without a token we stay on the LoginScreen.
  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      // Clean up any orphaned user record from before tokens existed.
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
      setLoading(false);
      return;
    }
    (async () => {
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const user = await res.json();
        setCurrentUserState(user);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(user)); } catch { /* noop */ }
        await refetchAll();
      } else {
        // Token rejected — clear and show login.
        setStoredToken(null);
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
        setLoading(false);
      }
    })();
  }, [refetchAll]);

  // Global 401 handler: any apiFetch that returns 401 fires this event.
  // Clear local state so the next render shows the LoginScreen.
  useEffect(() => {
    const handler = () => {
      setCurrentUserState(null);
      setStoredToken(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler);
  }, []);

  const value = useMemo<AppData>(
    () => ({
      leads, users, clients, sucursales, segmentos, productos, faltantes, pedidos, tareas, rechazoMotivos,
      currentUser: currentUserState,
      setCurrentUser,
      loading,
      leadsDesde,
      loadingOlderLeads,
      loadOlderLeads,
      upsertLead,
      removeLead,
      refetchAll,
      refetchLeads,
      refetchUsers,
      refetchFaltantes,
      refetchPedidos,
      refetchTareas,
    }),
    [
      leads, users, clients, sucursales, segmentos, productos, faltantes, pedidos, tareas, rechazoMotivos,
      currentUserState, setCurrentUser, loading,
      leadsDesde, loadingOlderLeads, loadOlderLeads,
      upsertLead, removeLead,
      refetchAll, refetchLeads, refetchUsers, refetchFaltantes, refetchPedidos, refetchTareas,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

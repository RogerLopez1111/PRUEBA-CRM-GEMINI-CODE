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
} from "../types";

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
  rechazoMotivos: { id: number; descripcion: string }[];

  // Auth
  currentUser: User | null;
  setCurrentUser: (u: User | null) => void;

  // Lifecycle
  loading: boolean;

  // Refetchers — granular for the hot paths, refetchAll for everything else
  refetchAll: () => Promise<void>;
  refetchLeads: () => Promise<void>;
  refetchUsers: () => Promise<void>;
  refetchFaltantes: () => Promise<void>;
  refetchPedidos: () => Promise<void>;
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
  const [currentUserState, setCurrentUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Auth setter persists to localStorage so refresh keeps the session.
  const setCurrentUser = useCallback((u: User | null) => {
    setCurrentUserState(u);
    try {
      if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* localStorage can throw in private-mode Safari; non-fatal */
    }
  }, []);

  const refetchLeads = useCallback(async () => {
    const res = await fetch("/api/leads");
    setLeads(await safeJson<Lead[]>(res, []));
  }, []);

  const refetchUsers = useCallback(async () => {
    const res = await fetch("/api/users");
    setUsers(await safeJson<User[]>(res, []));
  }, []);

  const refetchFaltantes = useCallback(async () => {
    const res = await fetch("/api/productos-faltantes");
    setFaltantes(await safeJson<ProductoFaltante[]>(res, []));
  }, []);

  const refetchPedidos = useCallback(async () => {
    const res = await fetch("/api/pedidos-extraordinarios");
    setPedidos(await safeJson<PedidoExtraordinario[]>(res, []));
  }, []);

  const refetchAll = useCallback(async () => {
    try {
      const [
        leadsRes, usersRes, clientsRes, sucursalesRes, segmentosRes,
        motivosRes, productosRes, faltantesRes, pedidosRes,
      ] = await Promise.all([
        fetch("/api/leads"),
        fetch("/api/users"),
        fetch("/api/clients"),
        fetch("/api/lookups/sucursales"),
        fetch("/api/lookups/segmentos"),
        fetch("/api/lookups/rechazo-motivos"),
        fetch("/api/productos"),
        fetch("/api/productos-faltantes"),
        fetch("/api/pedidos-extraordinarios"),
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
    } catch (err) {
      console.error("Error fetching data:", err);
      toast.error("Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial mount: restore session, then fetch data.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setCurrentUserState(JSON.parse(saved));
    } catch {
      /* ignore corrupted localStorage */
    }
    refetchAll();
  }, [refetchAll]);

  const value = useMemo<AppData>(
    () => ({
      leads, users, clients, sucursales, segmentos, productos, faltantes, pedidos, rechazoMotivos,
      currentUser: currentUserState,
      setCurrentUser,
      loading,
      refetchAll,
      refetchLeads,
      refetchUsers,
      refetchFaltantes,
      refetchPedidos,
    }),
    [
      leads, users, clients, sucursales, segmentos, productos, faltantes, pedidos, rechazoMotivos,
      currentUserState, setCurrentUser, loading,
      refetchAll, refetchLeads, refetchUsers, refetchFaltantes, refetchPedidos,
    ]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}

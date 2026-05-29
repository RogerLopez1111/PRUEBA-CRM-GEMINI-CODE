/**
 * Login screen — shown when no current user is set in AppDataContext. Posts
 * to /api/login, then hands the user record back via setCurrentUser (which
 * persists to localStorage) and triggers a full data refetch.
 */
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

import { useAppData } from "../../state/AppDataContext";
import { setStoredToken } from "../../lib/api";

export function LoginScreen() {
  const { setCurrentUser, refetchAll } = useAppData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const { token, user } = await res.json();
        setStoredToken(token);
        setCurrentUser(user);
        toast.success(`Bienvenido de nuevo, ${user.name}`);
        refetchAll();
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        setError(data.error || "Correo o contraseña incorrectos");
      }
    } catch {
      setError("Error al iniciar sesión");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-brand-navy flex items-center justify-center px-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-sm bg-white border border-neutral-200 border-t-4 border-t-brand-red">
        <div className="p-8 pb-6 border-b border-neutral-100">
          <img
            src="https://ecosistemas.com.mx/cdn/shop/files/logoeco.png?v=1758568786&width=260"
            alt="Ecosistemas"
            className="h-9 mb-4"
          />
          <h1 className="text-lg font-semibold text-brand-navy leading-tight">Panel de ventas</h1>
          <p className="text-xs text-brand-gray mt-0.5">Ingresa tus credenciales para continuar</p>
        </div>
        <div className="p-8 pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-brand-navy uppercase tracking-wide">Correo Electrónico</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@ecosistemas.com.mx"
                className="mt-1.5 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-brand-navy uppercase tracking-wide">Contraseña</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm focus:border-brand-red focus:outline-none focus:ring-1 focus:ring-brand-red"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-brand-red text-white py-2.5 text-sm font-semibold tracking-wide hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Entrando..." : "Iniciar sesión"}
            </button>
            {error && <p className="text-sm text-brand-red">{error}</p>}
          </form>
        </div>
      </div>
      <p className="absolute bottom-4 text-xs text-white/40">Ecosistemas · Soluciones Innovadoras</p>
    </main>
  );
}

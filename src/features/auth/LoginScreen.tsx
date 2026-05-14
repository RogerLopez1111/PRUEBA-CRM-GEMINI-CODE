/**
 * Login screen — shown when no current user is set in AppDataContext. Posts
 * to /api/login, then hands the user record back via setCurrentUser (which
 * persists to localStorage) and triggers a full data refetch.
 */
import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";

import { useAppData } from "../../state/AppDataContext";

export function LoginScreen() {
  const { setCurrentUser, refetchAll } = useAppData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        toast.success(`Bienvenido de nuevo, ${user.name}`);
        refetchAll();
      } else {
        const data = await res.json().catch(() => ({} as { error?: string }));
        toast.error(data.error || "Correo o contraseña incorrectos");
      }
    } catch {
      toast.error("Error al iniciar sesión");
    }
  };

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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-brand-navy ml-1">Contraseña</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

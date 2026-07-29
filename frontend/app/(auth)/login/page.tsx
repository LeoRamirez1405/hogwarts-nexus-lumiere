"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login(email, password);
      setAuth(res.user, res.access_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface parchment-bg px-4 py-8 md:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-primary text-6xl mb-4 block">
            auto_stories
          </span>
          <h1 className="font-display text-display-lg text-primary tracking-tight">
            Nexus Lumiere
          </h1>
          <p className="text-on-surface-variant font-body text-body-md mt-2">
            Plataforma social mágica
          </p>
        </div>

        <div className="glass-card rounded-xl p-8">
          <h2 className="font-display text-headline-lg text-primary mb-6 text-center">
            Iniciar Sesión
          </h2>

          {error && (
            <div className="bg-error-container text-on-error-container p-3 rounded-lg mb-4 text-body-md">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-mono text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
                Correo Electronico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="tu@nexus.com"
                required
              />
            </div>

            <div>
              <label className="block font-mono text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
                contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary rounded-full font-body font-semibold text-body-md hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>

          <div className="mt-6 p-4 bg-surface-container-low rounded-xl">
            <p className="font-mono text-label-sm text-on-surface-variant uppercase tracking-wider mb-2">
              Cuentas de prueba
            </p>
            <div className="space-y-1 text-body-md">
              <p>
                <span className="font-semibold text-primary">Admin:</span>{" "}
                admin@nexus.com / admin123
              </p>
              <p>
                <span className="font-semibold text-secondary">Usuario:</span>{" "}
                hermione@nexus.com / user123
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

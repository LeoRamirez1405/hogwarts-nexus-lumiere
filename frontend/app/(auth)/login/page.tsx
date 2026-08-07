"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login(email, password);
      setAuth(res.user);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4 py-8 md:py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="material-symbols-outlined text-primary text-6xl mb-4 block">
            auto_stories
          </span>
          <h1 className="font-display text-display-lg text-primary tracking-tight">
            Nexus Lumière  
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
                inputMode="email"
                autoComplete="email"
                enterKeyHint="next"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </div>

            <div>
              <label className="block font-mono text-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">
                contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-surface-container-low border border-outline-variant/30 rounded-xl text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  enterKeyHint="go"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  <MaterialIcon name={showPassword ? "visibility_off" : "visibility"} className="text-xl" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary text-on-primary rounded-full font-body font-semibold text-body-md hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

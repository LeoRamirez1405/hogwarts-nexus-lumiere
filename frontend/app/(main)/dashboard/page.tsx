"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api, DashboardData } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import ZerineDisplay from "@/components/ui/ZerineDisplay";

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-surface-container-high ${className}`}
    >
      <div className="p-6 space-y-3">
        <div className="h-4 bg-outline-variant/30 rounded w-1/2" />
        <div className="h-8 bg-outline-variant/30 rounded w-1/3" />
      </div>
    </div>
  );
}

function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-outline-variant/30" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-outline-variant/30 rounded w-1/3" />
            <div className="h-3 bg-outline-variant/30 rounded w-1/2" />
          </div>
          <div className="h-4 bg-outline-variant/30 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

function formatAmount(amount: number) {
  return amount.toLocaleString();
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ──────────────────────── ADMIN DASHBOARD ──────────────────────── */

function AdminDashboard({ data }: { data: DashboardData }) {
  const kpis = [
    {
      label: "Total Usuarios",
      value: data.total_users ?? 0,
      icon: "people",
      bg: "bg-primary",
      text: "text-on-primary",
    },
    {
      label: "Total Productos",
      value: data.total_products ?? 0,
      icon: "inventory_2",
      bg: "bg-secondary",
      text: "text-on-secondary",
    },
    {
      label: "Total Articulos",
      value: data.total_articles ?? 0,
      icon: "article",
      bg: "bg-tertiary",
      text: "text-on-tertiary",
    },
    {
      label: "Total Criaturas",
      value: data.total_creatures ?? 0,
      icon: "pets",
      bg: "bg-success",
      text: "text-on-success",
    },
    {
      label: "Total Zerines en Circulacion",
      value: data.total_zerines_in_circulation ?? 0,
      icon: "diamond",
      bg: "crystal-gradient inner-glow-gold",
      text: "text-on-primary",
    },
    {
      label: "Transacciones Recientes",
      value: data.recent_transactions?.length ?? 0,
      icon: "receipt_long",
      bg: "bg-surface-container",
      text: "text-on-surface",
    },
  ];

  return (
    <div className="space-y-8">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map((kpi) => (
          <GlassCard key={kpi.label} glow className="overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                  {kpi.label}
                </span>
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${kpi.bg} ${kpi.text}`}
                >
                  <MaterialIcon name={kpi.icon} className="text-xl" />
                </div>
              </div>
              <p className="font-display text-headline-lg text-on-surface">
                {formatAmount(kpi.value)}
              </p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Recent Transactions */}
      <GlassCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-title-md text-on-surface">
              Transacciones Recientes
            </h2>
            <Link
              href="/admin/transactions"
              className="text-label-sm text-primary hover:underline"
            >
              Ver todas
            </Link>
          </div>

          {data.recent_transactions && data.recent_transactions.length > 0 ? (
            <div className="space-y-4">
              {data.recent_transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 py-3 border-b border-outline-variant/20 last:border-0"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === "deposit"
                        ? "bg-success/10 text-success"
                        : tx.type === "withdrawal"
                          ? "bg-error/10 text-error"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    <MaterialIcon
                      name={
                        tx.type === "deposit"
                          ? "arrow_downward"
                          : tx.type === "withdrawal"
                            ? "arrow_upward"
                            : "swap_horiz"
                      }
                      className="text-xl"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface truncate">
                      {tx.description || tx.type}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {formatTime(tx.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <ZerineDisplay
                      amount={tx.amount}
                      variant={
                        tx.type === "withdrawal" || tx.type === "purchase"
                          ? "delta"
                          : "price"
                      }
                      iconStyle="icon"
                      size="md"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant text-body-md text-center py-8">
              No hay transacciones recientes
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

/* ──────────────────────── USER DASHBOARD ──────────────────────── */

const quickNavItems = [
  { icon: "mail", label: "Mensajes", href: "/messages", bg: "bg-primary/10", color: "text-primary" },
  { icon: "account_balance", label: "Tesoro", href: "/treasury", bg: "bg-secondary/10", color: "text-secondary" },
  { icon: "newspaper", label: "Quisquilloso", href: "/news", bg: "bg-tertiary/10", color: "text-tertiary" },
  { icon: "auto_stories", label: "Flourish & Blotts", href: "/marketplace/flourish-blotts", bg: "bg-[#8e44ad]/10", color: "text-[#8e44ad]" },
  { icon: "auto_fix_high", label: "Borgin & Burkes", href: "/marketplace/borgin-burkes", bg: "bg-inverse-surface/10", color: "text-inverse-surface" },
  { icon: "pets", label: "Mascotas", href: "/pets", bg: "bg-success/10", color: "text-success" },
];

function UserDashboard({
  data,
}: {
  data: DashboardData;
}) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="crystal-gradient rounded-2xl p-8 md:p-12 text-on-primary relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <h1 className="font-display text-display-lg mb-2">
            Domina el Nexus con Gracia
          </h1>
          <p className="text-on-primary/80 text-body-md mb-6 max-w-xl">
            Tu resumen personal en Hogwarts Nexus. Explora, comercia y conecta con la comunidad magica.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/marketplace/flourish-blotts" className="bg-on-primary text-primary rounded-full px-6 py-3 font-medium text-body-md hover:opacity-90 transition-all active:scale-95 inline-block">
              Explorar Flourish & Blotts
            </Link>
            <Link href="/marketplace/borgin-burkes" className="border border-on-primary/50 text-on-primary rounded-full px-6 py-3 font-medium text-body-md hover:bg-on-primary/10 transition-all active:scale-95 inline-block">
              Visitar Borgin & Burkes
            </Link>
          </div>
        </div>
      </div>

      {/* Profile Snippet + Greeting */}
      <div className="flex flex-col md:flex-row gap-6">
        <GlassCard className="flex-1">
          <div className="p-6 flex items-center gap-4">
            <div className="relative">
              {user?.avatar_url ? (
                <Image src={user.avatar_url} alt={user.name ?? ""} width={64} height={64} className="w-16 h-16 rounded-full object-cover" unoptimized />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-display text-headline-lg">
                  {(user?.name ?? "V").charAt(0)}
                </div>
              )}
              {user?.role === "admin" && (
                <span className="absolute -bottom-1 -right-1 bg-primary text-on-primary p-1 rounded-full">
                  <MaterialIcon name="verified" className="text-sm" filled />
                </span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-headline-lg text-on-surface">
                  Bienvenido, {user?.name ?? "Viajero"}
                </h1>
                {user?.house && (
                  <Badge variant="tag" color="primary">{user.house}</Badge>
                )}
              </div>
              <p className="text-on-surface-variant text-body-md mt-1">
                {isAdmin ? "Panel de administracion de Hogwarts Nexus" : "Tu resumen personal en Hogwarts Nexus"}
              </p>
            </div>
          </div>
        </GlassCard>

        {/* Admin Quick Actions (admin only) */}
        {isAdmin && (
          <GlassCard glow className="md:w-72">
            <div className="p-6">
              <h3 className="text-title-md font-display text-on-surface mb-3">Gestionar Admins</h3>
              <div className="space-y-2">
                <Link href="/admin/users" className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-body-md text-on-surface">
                  <MaterialIcon name="people" className="text-primary text-xl" /> Usuarios
                </Link>
                <Link href="/admin/products" className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-body-md text-on-surface">
                  <MaterialIcon name="inventory_2" className="text-secondary text-xl" /> Productos
                </Link>
                <Link href="/admin/articles" className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-body-md text-on-surface">
                  <MaterialIcon name="article" className="text-tertiary text-xl" /> Articulos
                </Link>
                <Link href="/admin/transactions" className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-high transition-colors text-body-md text-on-surface">
                  <MaterialIcon name="receipt_long" className="text-success text-xl" /> Transacciones
                </Link>
              </div>
            </div>
          </GlassCard>
        )}
      </div>

      {/* Personal Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard glow className="crystal-gradient inner-glow-gold overflow-hidden">
          <div className="p-6 text-on-primary">
            <span className="text-label-sm uppercase tracking-wider opacity-80">
              Zerines
            </span>
            <div className="mt-2 font-display text-headline-lg flex items-center gap-2">
              <span className="text-2xl">💎</span>
              {formatAmount(data.zerines ?? 0)}
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <MaterialIcon name="mail" className="text-xl" />
              </div>
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                Mensajes
              </span>
            </div>
            <p className="font-display text-headline-lg text-on-surface">
              {data.unread_messages ?? 0}
            </p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                <MaterialIcon name="pets" className="text-xl" />
              </div>
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                Mascotas
              </span>
            </div>
            <p className="font-display text-headline-lg text-on-surface">
              {data.my_creatures ?? 0}
            </p>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                <MaterialIcon name="newspaper" className="text-xl" />
              </div>
              <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                Posts
              </span>
            </div>
            <p className="font-display text-headline-lg text-on-surface">
              {data.my_posts ?? 0}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Quick Nav */}
      <div>
        <h2 className="font-display text-title-md text-on-surface mb-4">
          Acceso Rapido
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
          {quickNavItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <GlassCard hover glow className="h-full">
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className={`w-14 h-14 rounded-full ${item.bg} flex items-center justify-center ${item.color}`}>
                    <MaterialIcon name={item.icon} className="text-2xl" />
                  </div>
                  <span className="text-body-md text-on-surface font-medium">
                    {item.label}
                  </span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <GlassCard>
        <div className="p-6">
          <h2 className="font-display text-title-md text-on-surface mb-6">
            Actividad Reciente
          </h2>
          {data.recent_transactions && data.recent_transactions.length > 0 ? (
            <div className="space-y-4">
              {data.recent_transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-4 py-3 border-b border-outline-variant/20 last:border-0"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      tx.type === "deposit"
                        ? "bg-success/10 text-success"
                        : tx.type === "withdrawal"
                          ? "bg-error/10 text-error"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    <MaterialIcon
                      name={
                        tx.type === "deposit"
                          ? "arrow_downward"
                          : tx.type === "withdrawal"
                            ? "arrow_upward"
                            : "swap_horiz"
                      }
                      className="text-xl"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface truncate">
                      {tx.description || tx.type}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {formatTime(tx.created_at)}
                    </p>
                  </div>
                  <ZerineDisplay
                    amount={tx.amount}
                    variant={
                      tx.type === "withdrawal" || tx.type === "purchase"
                        ? "delta"
                        : "price"
                    }
                    iconStyle="icon"
                    size="md"
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-on-surface-variant text-body-md text-center py-8">
              No hay actividad reciente
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

/* ──────────────────────── PAGE ──────────────────────── */

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Greeting skeleton */}
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-outline-variant/30 rounded w-1/3" />
          <div className="h-4 bg-outline-variant/30 rounded w-1/4" />
        </div>
        {/* KPI skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        {/* Table skeleton */}
        <GlassCard>
          <div className="p-6">
            <SkeletonLines count={4} />
          </div>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <div className="p-12 text-center">
          <MaterialIcon
            name="error_outline"
            className="text-6xl text-error mb-4 block mx-auto"
          />
          <p className="text-on-surface text-title-md mb-2">
            Error al cargar el panel
          </p>
          <p className="text-on-surface-variant text-body-md">{error}</p>
        </div>
      </GlassCard>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-8">
      {isAdmin ? (
        <AdminDashboard data={data!} />
      ) : (
        <UserDashboard data={data!} />
      )}
    </div>
  );
}

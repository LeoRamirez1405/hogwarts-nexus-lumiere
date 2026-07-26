"use client";

import { useState, useEffect } from "react";
import { api, User } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SearchBar from "@/components/ui/SearchBar";
import Modal from "@/components/ui/Modal";

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

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "user">("user");
  const [editZerines, setEditZerines] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    api
      .getUsers()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const updated = await api.updateUser(editUser.id, {
        name: editName,
        role: editRole,
        zerines: parseInt(editZerines) || 0,
      });
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditUser(null);
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este usuario?")) return;
    try {
      await api.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {}
  };

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">
            Gestionar Usuarios
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            {users.length} usuarios registrados
          </p>
        </div>
        <div className="w-full md:w-80">
          <SearchBar
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={setSearch}
            size="md"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-outline-variant/30" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-outline-variant/30 rounded w-1/4" />
                  <div className="h-3 bg-outline-variant/30 rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">
                    Usuario
                  </th>
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">
                    Email
                  </th>
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">
                    Rol
                  </th>
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden sm:table-cell">
                    Zerines
                  </th>
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-display text-title-md">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-body-md font-medium text-on-surface">
                            {u.name}
                          </p>
                          <p className="text-label-sm text-on-surface-variant md:hidden">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <p className="text-body-md text-on-surface-variant">
                        {u.email}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="tag"
                        color={u.role === "admin" ? "secondary" : "default"}
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 hidden sm:table-cell">
                      <p className="text-body-md text-on-surface font-medium">
                        {u.zerines.toLocaleString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditUser(u);
                            setEditName(u.name);
                            setEditRole(u.role);
                            setEditZerines(u.zerines.toString());
                          }}
                          className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                        >
                          <MaterialIcon name="edit" className="text-lg" />
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          className="p-2 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                        >
                          <MaterialIcon name="delete" className="text-lg" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <MaterialIcon
                        name="people"
                        className="text-5xl text-outline-variant mb-3 block mx-auto"
                      />
                      <p className="text-on-surface-variant text-body-md">
                        No se encontraron usuarios
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Edit Modal */}
      {editUser && (
        <Modal open onClose={() => setEditUser(null)}>
          <div className="p-6 space-y-6">
            <h2 className="font-display text-headline-lg text-on-surface">
              Editar Usuario
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Rol
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditRole("user")}
                    className={`flex-1 py-3 rounded-xl font-medium text-body-md border transition-all ${
                      editRole === "user"
                        ? "bg-primary text-on-primary border-primary"
                        : "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-high"
                    }`}
                  >
                    Usuario
                  </button>
                  <button
                    onClick={() => setEditRole("admin")}
                    className={`flex-1 py-3 rounded-xl font-medium text-body-md border transition-all ${
                      editRole === "admin"
                        ? "bg-secondary text-on-secondary border-secondary"
                        : "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-high"
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Zerines
                </label>
                <input
                  type="number"
                  value={editZerines}
                  onChange={(e) => setEditZerines(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setEditUser(null)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving}
                className="flex-1"
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

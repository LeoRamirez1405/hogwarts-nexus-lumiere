"use client";

import { useState, useEffect } from "react";
import { api, User } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { AdminCrudModal, FormField, InputField, SelectField } from "@/components/ui/AdminCrudModal";
import ListFooter from "@/components/ui/ListFooter";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { MaterialIcon, Skeleton } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import PullToRefresh from "@/components/ui/PullToRefresh";

const HOUSES = ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"];

interface CreateUserData {
  name: string;
  email: string;
  password: string;
  house?: string;
  role: "admin" | "user";
}

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "admin" | "user">("all");
  const [houseFilter, setHouseFilter] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    house: "",
    role: "user" as "admin" | "user",
  });
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetting, setResetting] = useState(false);

  const crud = useAdminCrud<User, CreateUserData, Partial<User>>({
    queryKey: ["admin-users"],
    fetcher: (p) => api.getUsers(p),
    createFn: (data) => api.createUser(data),
    updateFn: (id, data) => api.adminUpdateUser(id, data),
    deleteFn: (id) => api.deleteUser(id),
    getDisplayName: (u) => u.name,
    getId: (u) => u.id,
    pageSize: 12,
    enabled: user?.role === "admin",
    resetKey: [filter, houseFilter],
    defaultCreateForm: {
      name: "",
      email: "",
      password: "",
      house: "",
      role: "user",
    },
    messages: {
      create: "Usuario creado",
      update: "Usuario actualizado",
      delete: "Usuario eliminado",
    },
    filterFn: (u, search) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  });

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const openCreate = () => {
    setForm({ name: "", email: "", password: "", house: "", role: "user" });
    crud.setShowCreate(true);
  };

  const openEdit = (u: User) => {
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      house: u.house || "",
      role: u.role,
    });
    crud.setEditItem(u);
  };

  const handleSave = async () => {
    if (crud.showCreate) {
      if (!form.email.trim() || !form.password.trim()) return;
      await crud.handleCreate({
        name: form.name,
        email: form.email,
        password: form.password,
        house: form.house || undefined,
        role: form.role,
      });
    } else if (crud.editItem) {
      await crud.handleSave(crud.editItem.id, {
        name: form.name,
        role: form.role,
        house: form.house || undefined,
        ...(form.password && { password: form.password }),
      });
    }
    setForm({ name: "", email: "", password: "", house: "", role: "user" });
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (resetPass.length < 4) { toastError("Mínimo 4 caracteres"); return; }
    if (resetPass !== resetConfirm) { toastError("Las contraseñas no coinciden"); return; }
    setResetting(true);
    try {
      await api.adminResetPassword(resetUser.id, resetPass);
      toastSuccess("Contraseña restablecida");
      setResetUser(null);
      setResetPass("");
      setResetConfirm("");
    } catch (e) {
      toastError("No se pudo restablecer la contraseña", e);
    }
    setResetting(false);
  };

  if (user?.role !== "admin") return null;

  const filtered = crud.filteredItems.filter(
    (u) => (!houseFilter || u.house === houseFilter) &&
      (filter === "all" || u.role === filter)
  );

return (
    <PullToRefresh onRefresh={crud.refresh}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-headline-lg text-on-surface">
              Gestionar Usuarios
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              {filtered.length} de {crud.totalCount} usuarios
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={crud.search}
              onChange={(e) => crud.setSearch(e.target.value)}
              className="w-full sm:w-80 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "all" | "admin" | "user")}
              className="px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Solo admins</option>
              <option value="user">Solo usuarios</option>
            </select>
            <select
              value={houseFilter}
              onChange={(e) => setHouseFilter(e.target.value)}
              className="px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            >
              <option value="">Todas las casas</option>
              {HOUSES.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
            <Button
              variant="primary"
              icon="person_add"
              iconPosition="left"
              onClick={openCreate}
            >
              Crear Usuario
            </Button>
          </div>
        </div>

        {crud.loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="list-item" />
            ))}
          </div>
        ) : (
          <>
            {/* MOBILE: Cards */}
            <div className="md:hidden space-y-4">
              {filtered.map((u) => (
                <div key={u.id} className="glass-card rounded-xl p-4 hover:bg-surface-container-high transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-display text-title-md shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md font-medium text-on-surface truncate">{u.name}</p>
                      <p className="text-label-sm text-on-surface-variant truncate">{u.email}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="tag" color={u.role === "admin" ? "secondary" : "default"}>
                          {u.role}
                        </Badge>
                        {u.house && (
                          <Badge variant="tag" color="default">{u.house}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/10">
                    <div className="flex flex-col gap-1">
                      <span className="text-label-sm text-on-surface-variant">Zerines</span>
                      <span className="text-body-md text-on-surface font-medium">
                        <MaterialIcon name="diamond" className="text-[1em] text-secondary" filled inline /> {u.zerines.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                      >
                        <MaterialIcon name="edit" className="text-lg" />
                      </button>
                      <button
                        onClick={() => {
                          setResetUser(u);
                          setResetPass("");
                          setResetConfirm("");
                        }}
                        className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors"
                        title="Restablecer contraseña"
                      >
                        <MaterialIcon name="lock_reset" className="text-lg" />
                      </button>
                      <button
                        onClick={() => crud.handleDelete(u.id)}
                        className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                      >
                        <MaterialIcon name="delete" className="text-lg" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="glass-card rounded-xl p-12 text-center">
                  <MaterialIcon name="people" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                  <p className="text-on-surface-variant text-body-md">No se encontraron usuarios</p>
                </div>
              )}
            </div>
            <div className="md:hidden">
              <ListFooter
                hasMore={crud.hasMore}
                loading={crud.loadingMore}
                pageSize={12}
                loaded={crud.totalLoaded}
                total={crud.totalCount}
                onLoadMore={crud.loadMore}
              />
            </div>

            {/* DESKTOP: Table */}
            <div className="hidden md:block glass-card rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-surface-container">
                    <tr className="border-b border-outline-variant/20">
                      <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">Usuario</th>
                      <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">Casa</th>
                      <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">Rol</th>
                      <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden sm:table-cell">Zerines</th>
                      <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-display text-title-md">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-body-md font-medium text-on-surface">{u.name}</p>
                              <p className="text-label-sm text-on-surface-variant md:hidden">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          {u.house ? <Badge variant="tag" color="default">{u.house}</Badge> : <span className="text-on-surface-variant text-label-sm">—</span>}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="tag" color={u.role === "admin" ? "secondary" : "default"}>{u.role}</Badge>
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <p className="text-body-md text-on-surface font-medium">
                            <MaterialIcon name="diamond" className="text-secondary" filled inline /> {u.zerines.toLocaleString()}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(u)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors" title="Editar">
                              <MaterialIcon name="edit" className="text-lg" />
                            </button>
                            <button onClick={() => { setResetUser(u); setResetPass(""); setResetConfirm(""); }} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-secondary transition-colors" title="Restablecer contraseña">
                              <MaterialIcon name="lock_reset" className="text-lg" />
                            </button>
                            <button onClick={() => crud.handleDelete(u.id)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors" title="Eliminar">
                              <MaterialIcon name="delete" className="text-lg" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <MaterialIcon name="people" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                          <p className="text-on-surface-variant text-body-md">No se encontraron usuarios</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-outline-variant/20">
                <ListFooter
                  hasMore={crud.hasMore}
                  loading={crud.loadingMore}
                  pageSize={12}
                  loaded={crud.totalLoaded}
                  total={crud.totalCount}
                  onLoadMore={crud.loadMore}
                />
              </div>
            </div>
          </>
        )}

        {(crud.editItem || crud.showCreate) && (
          <AdminCrudModal
            open
            onClose={() => { crud.setEditItem(null); crud.setShowCreate(false); }}
            title={crud.showCreate ? "Nuevo Usuario" : "Editar Usuario"}
            size="md"
            saving={crud.saving || crud.creating}
            onSave={handleSave}
          >
            <div className="space-y-4">
              <FormField label="Nombre" required>
                <InputField
                  value={form.name}
                  onChange={(v: string) => setForm((p) => ({ ...p, name: v }))}
                  autoFocus
                  firstInput
                  placeholder="Ej: Neville Longbottom"
                />
              </FormField>
              {crud.showCreate && (
                <>
                  <FormField label="Email" required>
                    <InputField
                      type="email"
                      value={form.email}
                      onChange={(v: string) => setForm((p) => ({ ...p, email: v }))}
                      placeholder="Ej: neville@nexus.com"
                    />
                  </FormField>
                  <FormField label="Contraseña temporal" required>
                    <InputField
                      type="text"
                      value={form.password}
                      onChange={(v: string) => setForm((p) => ({ ...p, password: v }))}
                      placeholder="El usuario deberá cambiarla después"
                    />
                  </FormField>
                </>
              )}
              <FormField label="Rol" required>
                <SelectField
                  value={form.role}
                  onChange={(v: string) => setForm((p) => ({ ...p, role: v as "admin" | "user" }))}
                  options={[
                    { value: "user", label: "Usuario" },
                    { value: "admin", label: "Admin" },
                  ]}
                  placeholder="Seleccionar..."
                />
              </FormField>
              <FormField label="Casa">
                <SelectField
                  value={form.house}
                  onChange={(v: string) => setForm((p) => ({ ...p, house: v }))}
                  options={HOUSES.map((h) => ({ value: h, label: h }))}
                  placeholder="Sin casa asignada"
                />
              </FormField>
            </div>
          </AdminCrudModal>
        )}

        {resetUser && (
          <AdminCrudModal
            open
            onClose={() => { setResetUser(null); setResetPass(""); setResetConfirm(""); }}
            title="Restablecer contraseña"
            size="sm"
            saving={resetting}
            onSave={handleResetPassword}
          >
            <div className="space-y-4">
              <p className="text-on-surface-variant text-body-md">
                Establecer nueva contraseña para <strong>{resetUser.name}</strong>
              </p>
              <FormField label="Nueva contraseña" required>
                <InputField
                  type="password"
                  value={resetPass}
                  onChange={(v: string) => setResetPass(v)}
                  placeholder="Mínimo 4 caracteres"
                  autoFocus
                  firstInput
                />
              </FormField>
              <FormField label="Confirmar contraseña" required>
                <InputField
                  type="password"
                  value={resetConfirm}
                  onChange={(v: string) => setResetConfirm(v)}
                  placeholder="Repetir contraseña"
                />
              </FormField>
            </div>
          </AdminCrudModal>
        )}
      </div>
    </PullToRefresh>
  );
}
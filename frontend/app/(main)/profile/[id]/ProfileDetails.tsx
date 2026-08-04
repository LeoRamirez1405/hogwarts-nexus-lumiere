"use client";

import { useState, useEffect } from "react";
import { api, User, HousePoints } from "@/lib/api";
import { GlassCard, ProgressBar, MaterialIcon } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";

function InlineEditable({
  icon,
  value,
  placeholder,
  isOwn,
  isAdmin,
  onSave,
}: {
  icon: string;
  value: string;
  placeholder: string;
  isOwn: boolean;
  isAdmin?: boolean;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const canEdit = isOwn || isAdmin;

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  const handleStartEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  if (editing) {
    return (
      <li className="flex items-center gap-3 border-l-4 border-secondary pl-3">
        <MaterialIcon name={icon} className="text-lg text-secondary shrink-0" />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          onBlur={handleSave}
          className="flex-1 text-body-md bg-surface-container-high rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-primary/30"
          placeholder={placeholder}
          maxLength={80}
          enterKeyHint="done"
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-l-4 border-secondary pl-3 group">
      <MaterialIcon name={icon} className="text-lg text-secondary" />
      <span
        className={`text-body-md flex-1 cursor-pointer ${
          value ? "text-on-surface-variant" : "text-on-surface-variant/50 italic"
        }`}
        onClick={canEdit ? handleStartEdit : undefined}
      >
        {value || placeholder}
      </span>
      {canEdit && (
        <button
          onClick={handleStartEdit}
          className={`ml-auto p-1 rounded-full hover:bg-surface-container-high transition-opacity ${
            value ? "opacity-0 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100" : "opacity-0 md:opacity-0"
          }`}
          aria-label="Editar"
        >
          <MaterialIcon name="edit" className="text-sm text-on-surface-variant" />
        </button>
      )}
    </li>
  );
}

const HOUSE_COLORS: Record<string, string> = {
  Gryffindor: "bg-red-600",
  Slytherin: "bg-green-700",
  Ravenclaw: "bg-blue-700",
  Hufflepuff: "bg-yellow-500",
};

export default function ProfileDetails({
  profile,
  isOwn,
  onUpdate,
}: {
  profile: User;
  isOwn: boolean;
  onUpdate?: () => void;
}) {
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === "admin";
  const level = profile.magic_level;
  const [titleDraft, setTitleDraft] = useState(profile.official_title || "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [housePoints, setHousePoints] = useState<HousePoints | null>(null);

  useEffect(() => {
    if (profile.house && !housePoints) {
      api.getHousePoints(profile.house).then(setHousePoints).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.house]);

  const handleUpdate = async (field: string, value: string | null) => {
    try {
      await api.updateUser(profile.id, { [field]: value } as Record<string, unknown>);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to update:", err);
    }
  };

  const handleSaveTitle = async () => {
    try {
      await api.setUserTitle(profile.id, titleDraft || null);
      setEditingTitle(false);
      onUpdate?.();
    } catch (err) {
      console.error("Failed to set title:", err);
    }
  };

  return (
    <GlassCard className="p-6">
      <h3 className="text-title-md font-display text-on-surface text-center mb-4">
        Detalles
      </h3>
      <ul className="space-y-3">
        {/* Magic Level - Auto calculated, no edit */}
        {level && (
          <li className="flex flex-col gap-1.5 border-l-4 border-primary pl-3">
            <div className="flex items-center gap-2">
              <MaterialIcon name="auto_awesome" className="text-lg text-primary" />
              <span className="text-body-md font-semibold text-on-surface">
                Nivel {level.level} — {level.name}
              </span>
            </div>
            <div className="ml-7">
              <ProgressBar
                value={level.xp}
                max={level.next_xp}
                color="primary"
                size="sm"
              />
              <p className="text-label-sm text-on-surface-variant mt-1">
                {level.xp} / {level.next_xp} XP
              </p>
            </div>
          </li>
        )}

        {/* Official Title - Admin editable */}
        {(profile.official_title || isAdmin) && (
          <li className="flex items-center gap-3 border-l-4 border-secondary pl-3 group">
            <MaterialIcon name="verified" className="text-lg text-secondary" />
            {editingTitle ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                onBlur={handleSaveTitle}
                className="flex-1 text-body-md bg-surface-container-high rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Titulo oficial..."
                maxLength={60}
                enterKeyHint="done"
              />
            ) : (
              <span
                className={`text-body-md ${
                  profile.official_title
                    ? "text-on-surface-variant font-medium"
                    : "text-on-surface-variant/50 italic"
                } ${isAdmin ? "cursor-pointer hover:text-primary transition-colors" : ""}`}
                onClick={isAdmin ? () => setEditingTitle(true) : undefined}
              >
                {profile.official_title || "Sin titulo oficial"}
              </span>
            )}
            {isAdmin && profile.official_title && (
              <button
                onClick={() => setEditingTitle(!editingTitle)}
                className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-surface-container-high transition-opacity"
              >
                <MaterialIcon name="edit" className="text-sm text-on-surface-variant" />
              </button>
            )}
          </li>
        )}

        {/* House Points - Auto loaded */}
        {profile.house && (
          <li className="flex items-center gap-3 border-l-4 border-secondary pl-3">
            <MaterialIcon name="workspace_premium" className="text-lg text-secondary" />
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${HOUSE_COLORS[profile.house] || "bg-gray-400"}`} />
              <span className="text-body-md text-on-surface-variant">
                {profile.house} · {housePoints ? `${housePoints.points.toLocaleString()} pts` : "cargando..."}
              </span>
            </div>
          </li>
        )}

        {/* Status - User editable */}
        <InlineEditable
          icon="mood"
          value={profile.status || ""}
          placeholder="Escribe tu estado..."
          isOwn={isOwn}
          onSave={(v) => handleUpdate("status", v)}
        />

        {/* Wand - User editable */}
        <InlineEditable
          icon="auto_fix_high"
          value={profile.wand || ""}
          placeholder="Varita..."
          isOwn={isOwn}
          onSave={(v) => handleUpdate("wand", v)}
        />

        {/* Location - User editable */}
        <InlineEditable
          icon="location_on"
          value={profile.location || ""}
          placeholder="Ubicación..."
          isOwn={isOwn}
          onSave={(v) => handleUpdate("location", v)}
        />
      </ul>
    </GlassCard>
  );
}

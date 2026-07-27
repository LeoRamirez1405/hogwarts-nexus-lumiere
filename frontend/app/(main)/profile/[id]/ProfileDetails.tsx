"use client";

import { useState } from "react";
import Image from "next/image";
import { api, User, HousePoints } from "@/lib/api";
import { GlassCard, ProgressBar } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";

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
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-l-4 border-secondary pl-3 group">
      <MaterialIcon name={icon} className="text-lg text-secondary" />
      <span className={`text-body-md ${value ? "text-on-surface-variant" : "text-on-surface-variant/50 italic"}`}>
        {value || placeholder}
      </span>
      {canEdit && (
        <button
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-surface-container-high transition-opacity"
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

const HOUSE_IMAGES: Record<string, string> = {
  Gryffindor: "/images/houses/gryffindor.png",
  Slytherin: "/images/houses/slytherin.png",
  Ravenclaw: "/images/houses/ravenclaw.png",
  Hufflepuff: "/images/houses/hufflepuff.png",
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

  const loadHousePoints = async () => {
    if (!profile.house || housePoints) return;
    try {
      const data = await api.getHousePoints(profile.house);
      setHousePoints(data);
    } catch {}
  };

  return (
    <GlassCard className="p-6">
      <h3 className="text-title-md font-display text-on-surface mb-4">
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
              />
            ) : (
              <span className={`text-body-md ${profile.official_title ? "text-on-surface-variant font-medium" : "text-on-surface-variant/50 italic"}`}>
                {profile.official_title || "Sin titulo oficial"}
              </span>
            )}
            {isAdmin && (
              <button
                onClick={() => setEditingTitle(!editingTitle)}
                className="ml-auto opacity-0 group-hover:opacity-100 p-1 rounded-full hover:bg-surface-container-high transition-opacity"
              >
                <MaterialIcon name="edit" className="text-sm text-on-surface-variant" />
              </button>
            )}
          </li>
        )}

        {/* House Points - Auto calculated, no edit */}
        {profile.house && (
          <li
            className="flex items-center gap-3 border-l-4 border-secondary pl-3 cursor-pointer hover:bg-surface-container-high/30 rounded-r transition-colors"
            onClick={loadHousePoints}
          >
            <MaterialIcon name="workspace_premium" className="text-lg text-secondary" />
            <div className="flex items-center gap-2">
              {HOUSE_IMAGES[profile.house] ? (
                <div className="relative w-5 h-5 rounded overflow-hidden">
                  <Image
                    src={HOUSE_IMAGES[profile.house]}
                    alt={profile.house}
                    fill
                    className="object-contain"
                  />
                </div>
              ) : (
                <div className={`w-2.5 h-2.5 rounded-full ${HOUSE_COLORS[profile.house] || "bg-gray-400"}`} />
              )}
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
          placeholder="Ubicacion..."
          isOwn={isOwn}
          onSave={(v) => handleUpdate("location", v)}
        />
      </ul>
    </GlassCard>
  );
}

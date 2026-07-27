"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  api,
  Creature,
  UserCreature,
  PetItem,
  UserPetItem,
  PetType,
} from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import Avatar from "@/components/ui/Avatar";
import ProgressBar from "@/components/ui/ProgressBar";
import ZerineDisplay from "@/components/ui/ZerineDisplay";
import TabGroup from "@/components/ui/TabGroup";

const RARITY_LABELS: Record<string, string> = {
  common: "Comun",
  uncommon: "Poco Comun",
  rare: "Raro",
  legendary: "Legendario",
  ethereal: "Etereo",
};

const RARITY_COLORS: Record<string, string> = {
  rare: "text-primary",
  uncommon: "text-secondary",
  ethereal: "text-tertiary",
  legendary: "text-secondary",
  common: "text-outline",
};

const RARITY_BG: Record<string, string> = {
  rare: "bg-primary/5",
  uncommon: "bg-secondary/5",
  ethereal: "bg-tertiary/5",
  legendary: "bg-secondary/10",
  common: "bg-surface-container-high/50",
};

const PET_TYPE_LABELS: Record<PetType, string> = {
  avian: "Aves",
  beast: "Bestias",
  critter: "Criaturas pequeñas",
};

const MOOD_META: Record<string, { icon: string; label: string; color: string }> = {
  hambriento: { icon: "restaurant", label: "Hambriento", color: "text-error" },
  triste: { icon: "sentiment_dissatisfied", label: "Triste", color: "text-error" },
  feliz: { icon: "sentiment_very_satisfied", label: "Feliz", color: "text-success" },
  bien: { icon: "sentiment_satisfied", label: "Bien", color: "text-on-surface-variant" },
};

type Picker = { ucId: string; mode: "feed" | "play" } | null;

export default function PetsPage() {
  const { user, setUser } = useAuthStore();
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [myCreatures, setMyCreatures] = useState<UserCreature[]>([]);
  const [petItems, setPetItems] = useState<PetItem[]>([]);
  const [inventory, setInventory] = useState<UserPetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adopting, setAdopting] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [using, setUsing] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("mine");
  const [picker, setPicker] = useState<Picker>(null);
  const [shopType, setShopType] = useState<PetType | "all">("all");

  useEffect(() => {
    Promise.all([
      api.getCreatures(),
      api.getMyCreatures(),
      api.getPetItems(),
      api.getPetInventory(),
    ])
      .then(([c, mc, items, inv]) => {
        setCreatures(c);
        setMyCreatures(mc);
        setPetItems(items);
        setInventory(inv);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refreshUser = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {}
  };

  const handleAdopt = async (creatureId: string) => {
    setAdopting(creatureId);
    try {
      const adopted = await api.adoptCreature(creatureId);
      setMyCreatures((prev) => [...prev, adopted]);
      await refreshUser();
    } catch {
    } finally {
      setAdopting(null);
    }
  };

  const handleBuy = async (item: PetItem) => {
    setBuying(item.id);
    try {
      const row = await api.buyPetItem(item.id, 1);
      setInventory((prev) => {
        const idx = prev.findIndex((r) => r.pet_item_id === item.id);
        if (idx === -1) return [...prev, { ...row, pet_item: item }];
        const next = [...prev];
        next[idx] = { ...row, pet_item: item };
        return next;
      });
      await refreshUser();
    } catch {
    } finally {
      setBuying(null);
    }
  };

  const handleUse = async (uc: UserCreature, item: UserPetItem) => {
    if (!item.pet_item) return;
    const mode = item.pet_item.kind === "food" ? "feed" : "play";
    setUsing(item.id);
    try {
      const updated =
        mode === "feed"
          ? await api.feedCreature(uc.id, item.pet_item_id)
          : await api.playCreature(uc.id, item.pet_item_id);
      setMyCreatures((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      // Consume one unit locally.
      setInventory((prev) =>
        prev
          .map((r) =>
            r.id === item.id ? { ...r, quantity: r.quantity - 1 } : r
          )
          .filter((r) => r.quantity > 0)
      );
      setPicker(null);
    } catch {
    } finally {
      setUsing(null);
    }
  };

  const inventoryFor = (petType: PetType, kind: "food" | "toy") =>
    inventory.filter(
      (r) =>
        r.quantity > 0 &&
        r.pet_item?.kind === kind &&
        r.pet_item?.pet_type === petType
    );

  const adoptedIds = new Set(myCreatures.map((uc) => uc.creature_id));
  const shopItems =
    shopType === "all"
      ? petItems
      : petItems.filter((i) => i.pet_type === shopType);
  const shopFoods = shopItems.filter((i) => i.kind === "food");
  const shopToys = shopItems.filter((i) => i.kind === "toy");

  return (
    <div className="min-h-[calc(100vh-5rem)] -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
      <div className="max-w-7xl mx-auto mb-10">
        <div className="bg-primary-fixed/30 border border-primary/20 rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                pets
              </span>
              <span className="text-primary text-label-sm uppercase tracking-[0.2em]">Hogwarts</span>
            </div>
            <h1 className="font-display text-display-lg text-primary mb-2">
              La Menajeria Susurrante
            </h1>
            <p className="text-on-surface-variant text-body-md mb-6 max-w-xl">
              Encuentra tu companion magico. Cuidalo, aliment&aacute;lo y juega con &eacute;l: con el tiempo tendra hambre y necesitara carino.
            </p>

            <div className="flex flex-wrap gap-4">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-primary/10">
                <span className="material-symbols-outlined text-primary text-[1.4em]" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                  pets
                </span>
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Mis Mascotas</p>
                  <p className="text-title-md font-bold text-on-surface">{myCreatures.length}</p>
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-secondary/10">
                <span className="material-symbols-outlined text-secondary text-[1.4em]" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                  inventory_2
                </span>
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Objetos en inventario</p>
                  <p className="text-title-md font-bold text-on-surface">
                    {inventory.reduce((sum, r) => sum + r.quantity, 0)}
                  </p>
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-secondary/10">
                <span className="material-symbols-outlined text-secondary text-[1.4em]" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                  diamond
                </span>
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Zerines disponibles</p>
                  <p className="text-title-md font-bold text-on-surface">{user?.zerines?.toLocaleString() ?? "0"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8">
        <TabGroup
          tabs={[
            { id: "mine", label: "Mis Mascotas", icon: "favorite" },
            { id: "adopt", label: "Adoptar", icon: "pets" },
            { id: "shop", label: "Tienda", icon: "storefront" },
          ]}
          activeTab={activeTab}
          onChange={(t) => { setActiveTab(t); setPicker(null); }}
        />
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === "adopt" && (
          <>
            <h2 className="font-display text-headline-lg text-primary mb-6">
              Criaturas Disponibles para Adopción
            </h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-3xl p-6 animate-pulse">
                  <div className="h-56 bg-surface-container-high rounded-2xl mb-4" />
                  <div className="h-5 bg-surface-container-high rounded w-1/2 mb-2" />
                  <div className="h-4 bg-surface-container-high rounded w-full mb-4" />
                  <div className="h-9 bg-surface-container-high rounded-full w-1/3" />
                </div>
              ))}
            </div>
          ) : creatures.length === 0 ? (
            <div className="text-center py-20">
              <span
                className="material-symbols-outlined text-on-surface-variant text-6xl block mb-4"
                style={{
                  fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                }}
              >
                pets
              </span>
              <p className="text-on-surface-variant text-body-md">
                No hay criaturas disponibles.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {creatures.map((creature) => {
                const isAdopted = adoptedIds.has(creature.id);
                return (
                  <div
                    key={creature.id}
                    className={`glass-card rounded-3xl p-6 group cursor-pointer hover:-translate-y-2 transition-all duration-300 ${RARITY_BG[creature.rarity] || ""}`}
                  >
                    <div className="relative h-56 rounded-2xl overflow-hidden mb-4">
                      <Image
                        src={creature.image_url || "/placeholder-creature.jpg"}
                        alt={creature.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <span
                        className={`absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-label-sm font-bold shadow-sm ${RARITY_COLORS[creature.rarity] || "text-outline"}`}
                      >
                        {RARITY_LABELS[creature.rarity] || creature.rarity}
                      </span>
                      <span className="absolute top-4 left-4 bg-on-surface/70 text-white backdrop-blur-md px-3 py-1 rounded-full text-label-sm font-medium">
                        {PET_TYPE_LABELS[creature.pet_type] || creature.pet_type}
                      </span>
                    </div>
                    <h3 className="font-display text-title-md text-primary mb-1">
                      {creature.name}
                    </h3>
                    <p className="text-on-surface-variant text-body-md line-clamp-2 mb-4">
                      {creature.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <ZerineDisplay
                        amount={creature.price}
                        iconStyle="icon"
                        variant="price"
                      />
                      {isAdopted ? (
                        <span className="text-label-sm text-success font-bold flex items-center gap-1">
                          <span
                            className="material-symbols-outlined text-[1em]"
                            style={{
                              fontVariationSettings:
                                '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24',
                            }}
                          >
                            check_circle
                          </span>
                          Adoptada
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAdopt(creature.id)}
                          disabled={adopting === creature.id}
                          className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold text-label-sm inner-sparkle hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {adopting === creature.id ? "Adoptando..." : "Adoptar"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

        {activeTab === "mine" && (
          <>
            <h2 className="font-display text-headline-lg text-primary mb-6">
              Mis Mascotas
            </h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="bg-white border border-outline-variant/30 rounded-3xl p-6 animate-pulse"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-surface-container-high" />
                    <div className="space-y-2">
                      <div className="h-4 bg-surface-container-high rounded w-24" />
                      <div className="h-3 bg-surface-container-high rounded w-20" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-8 bg-surface-container-high rounded" />
                    <div className="h-8 bg-surface-container-high rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : myCreatures.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <button
                onClick={() => setActiveTab("adopt")}
                className="border-2 border-dashed border-outline-variant/50 rounded-3xl flex flex-col items-center justify-center py-16 cursor-pointer hover:border-primary/30 transition-colors"
              >
                <span
                  className="material-symbols-outlined text-on-surface-variant text-4xl mb-2"
                  style={{
                    fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                  }}
                >
                  add
                </span>
                <p className="text-on-surface-variant text-body-md">
                  Adopta tu primera criatura
                </p>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCreatures.map((uc) => {
                const petType = uc.creature?.pet_type ?? "critter";
                const mood = MOOD_META[uc.mood] ?? MOOD_META.bien;
                const isFeedOpen = picker?.ucId === uc.id && picker.mode === "feed";
                const isPlayOpen = picker?.ucId === uc.id && picker.mode === "play";
                const foods = inventoryFor(petType, "food");
                const toys = inventoryFor(petType, "toy");
                return (
                <div
                  key={uc.id}
                  className="bg-white border border-outline-variant/30 rounded-3xl p-6"
                >
                  {/* Header */}
                  <div className="flex items-center gap-4 mb-5">
                    <Avatar
                      src={uc.creature?.image_url}
                      alt={uc.creature?.name}
                      size="lg"
                      borderColor="primary"
                      initials={uc.creature?.name?.charAt(0) ?? "?"}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display text-title-md text-on-surface truncate">
                        {uc.creature?.name}
                      </h4>
                      <p className="text-label-sm text-on-surface-variant">
                        Guardian Nivel {uc.level} &middot; {PET_TYPE_LABELS[petType]}
                      </p>
                    </div>
                    <span
                      className={`flex items-center gap-1 text-label-sm font-bold ${mood.color}`}
                      title={mood.label}
                    >
                      <span
                        className="material-symbols-outlined text-[1.3em]"
                        style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}
                      >
                        {mood.icon}
                      </span>
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3 mb-5">
                    <ProgressBar
                      value={uc.hunger}
                      max={100}
                      color={uc.hunger <= 20 ? "error" : "success"}
                      label="Hambre"
                      showValue
                    />
                    <ProgressBar
                      value={uc.happiness}
                      max={100}
                      color={uc.happiness <= 20 ? "error" : "primary"}
                      label="Felicidad"
                      showValue
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setPicker(isFeedOpen ? null : { ucId: uc.id, mode: "feed" })}
                      className={`flex-1 flex items-center justify-center gap-2 border rounded-xl py-2 text-label-sm font-bold transition-all active:scale-95 ${isFeedOpen ? "bg-success text-on-success border-success" : "border-success text-success hover:bg-success hover:text-on-success"}`}
                    >
                      <span
                        className="material-symbols-outlined text-[1.1em]"
                        style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
                      >
                        restaurant
                      </span>
                      Alimentar
                    </button>
                    <button
                      onClick={() => setPicker(isPlayOpen ? null : { ucId: uc.id, mode: "play" })}
                      className={`flex-1 flex items-center justify-center gap-2 border rounded-xl py-2 text-label-sm font-bold transition-all active:scale-95 ${isPlayOpen ? "bg-primary text-on-primary border-primary" : "border-primary text-primary hover:bg-primary hover:text-on-primary"}`}
                    >
                      <span
                        className="material-symbols-outlined text-[1.1em]"
                        style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
                      >
                        sports_esports
                      </span>
                      Jugar
                    </button>
                  </div>

                  {/* Item picker */}
                  {(isFeedOpen || isPlayOpen) && (
                    <div className="mt-4 border-t border-outline-variant/30 pt-4">
                      <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">
                        {isFeedOpen ? "Elige comida" : "Elige un juguete"} para {PET_TYPE_LABELS[petType].toLowerCase()}
                      </p>
                      {(isFeedOpen ? foods : toys).length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-on-surface-variant text-body-sm mb-2">
                            No tienes {isFeedOpen ? "comida" : "juguetes"} para este tipo.
                          </p>
                          <button
                            onClick={() => { setActiveTab("shop"); setShopType(petType); setPicker(null); }}
                            className="text-primary text-label-sm font-bold hover:underline"
                          >
                            Ir a la Tienda
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(isFeedOpen ? foods : toys).map((row) => (
                            <button
                              key={row.id}
                              onClick={() => handleUse(uc, row)}
                              disabled={using === row.id}
                              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors text-left disabled:opacity-50"
                            >
                              <span
                                className="material-symbols-outlined text-primary text-[1.3em]"
                                style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
                              >
                                {isFeedOpen ? "nutrition" : "toys"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-body-sm font-medium text-on-surface truncate">
                                  {row.pet_item?.name}
                                </p>
                                <p className="text-label-sm text-on-surface-variant">
                                  +{row.pet_item?.restore_amount} {isFeedOpen ? "hambre" : "felicidad"} &middot; x{row.quantity}
                                </p>
                              </div>
                              <span className="text-label-sm text-on-surface-variant">
                                {using === row.id ? "..." : "Usar"}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}

              {/* Empty slot */}
              <button
                onClick={() => setActiveTab("adopt")}
                className="border-2 border-dashed border-outline-variant/50 rounded-3xl flex flex-col items-center justify-center py-16 cursor-pointer hover:border-primary/30 transition-colors"
              >
                <span
                  className="material-symbols-outlined text-on-surface-variant text-4xl mb-2"
                  style={{
                    fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                  }}
                >
                  add
                </span>
                <p className="text-on-surface-variant text-body-md">
                  Adoptar otra criatura
                </p>
              </button>
            </div>
          )}
        </>
      )}

        {activeTab === "shop" && (
          <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="font-display text-headline-lg text-primary">
                Tienda de Mascotas
              </h2>
              <div className="flex flex-wrap gap-2">
                {(["all", "avian", "beast", "critter"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setShopType(t)}
                    className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
                      shopType === t
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                    }`}
                  >
                    {t === "all" ? "Todos" : PET_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="glass-card rounded-2xl p-5 animate-pulse h-32" />
                ))}
              </div>
            ) : (
              <div className="space-y-10">
                <ShopSection
                  title="Comida"
                  icon="nutrition"
                  items={shopFoods}
                  inventory={inventory}
                  buying={buying}
                  onBuy={handleBuy}
                  statLabel="hambre"
                />
                <ShopSection
                  title="Juguetes"
                  icon="toys"
                  items={shopToys}
                  inventory={inventory}
                  buying={buying}
                  onBuy={handleBuy}
                  statLabel="felicidad"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ShopSection({
  title,
  icon,
  items,
  inventory,
  buying,
  onBuy,
  statLabel,
}: {
  title: string;
  icon: string;
  items: PetItem[];
  inventory: UserPetItem[];
  buying: string | null;
  onBuy: (item: PetItem) => void;
  statLabel: string;
}) {
  if (items.length === 0) return null;
  const ownedQty = (id: string) =>
    inventory.find((r) => r.pet_item_id === id)?.quantity ?? 0;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span
          className="material-symbols-outlined text-primary text-2xl"
          style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
        >
          {icon}
        </span>
        <h3 className="font-display text-title-lg text-on-surface">{title}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const owned = ownedQty(item.id);
          return (
            <div
              key={item.id}
              className="glass-card rounded-2xl p-5 flex flex-col"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-label-sm text-secondary bg-secondary/10 px-2 py-0.5 rounded-full font-medium">
                    {PET_TYPE_LABELS[item.pet_type]}
                  </span>
                  {item.pack_size > 1 && (
                    <span className="text-label-sm text-tertiary bg-tertiary/10 px-2 py-0.5 rounded-full font-medium">
                      Lote x{item.pack_size}
                    </span>
                  )}
                </div>
                {owned > 0 && (
                  <span className="text-label-sm text-on-surface-variant">
                    Tienes: {owned}
                  </span>
                )}
              </div>
              <h4 className="font-display text-title-sm text-on-surface mb-1">
                {item.name}
              </h4>
              <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-3 flex-1">
                {item.description}
              </p>
              <div className="flex items-center gap-3 mb-3 text-label-sm">
                <span className="flex items-center gap-1 text-success font-medium">
                  <span
                    className="material-symbols-outlined text-[1.1em]"
                    style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}
                  >
                    add_circle
                  </span>
                  +{item.restore_amount} {statLabel}
                </span>
                {item.pack_size > 1 && (
                  <span className="text-on-surface-variant">{item.pack_size} usos</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <ZerineDisplay amount={item.price} iconStyle="icon" variant="price" />
                <button
                  onClick={() => onBuy(item)}
                  disabled={buying === item.id}
                  className="bg-primary text-on-primary px-5 py-2 rounded-full font-bold text-label-sm hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {buying === item.id ? "..." : "Comprar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

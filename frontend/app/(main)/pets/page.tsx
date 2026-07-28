"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  api,
  Creature,
  UserCreature,
  PetItem,
  UserPetItem,
  MarketCreature,
  SanctuaryStats,
  PetType,
} from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { TabGroup, LevelUpCelebration, Modal, Button } from "@/components/ui";
import type { LevelUpEvent } from "@/components/ui/LevelUpCelebration";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { CreatureCard, PetCard, ShopSection, MarketCreatureCard } from "@/components/domain/Pets";

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
  const [market, setMarket] = useState<MarketCreature[]>([]);
  const [stats, setStats] = useState<SanctuaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [adopting, setAdopting] = useState<string | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [using, setUsing] = useState<string | null>(null);
  const [buyingPet, setBuyingPet] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("mine");
  const [picker, setPicker] = useState<Picker>(null);
  const [shopType, setShopType] = useState<PetType | "all">("all");
  const [sellFor, setSellFor] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const [celebrations, setCelebrations] = useState<LevelUpEvent[]>([]);
  // Modal de nombre al adoptar
  const [adoptModal, setAdoptModal] = useState<Creature | null>(null);
  const [adoptPetName, setAdoptPetName] = useState("");

  // Previous-value refs for level-up detection.
  const petLevels = useRef<Record<string, number>>({});
  const prevSanctuary = useRef<number | null>(null);
  const prevUserLevel = useRef<number | null>(null);
  const celebId = useRef(0);

  const pushCelebration = useCallback((ev: Omit<LevelUpEvent, "id">) => {
    celebId.current += 1;
    setCelebrations((q) => [...q, { ...ev, id: celebId.current }]);
  }, []);

  // Compare fresh stats against refs and celebrate sanctuary / user level-ups.
  const applyStats = useCallback(
    (s: SanctuaryStats, celebrate: boolean) => {
      if (celebrate) {
        if (prevSanctuary.current !== null && s.sanctuary_level > prevSanctuary.current) {
          pushCelebration({
            kind: "sanctuary",
            title: `Santuario Nivel ${s.sanctuary_level}`,
            subtitle: `de ${s.sanctuary_max}`,
          });
        }
        if (prevUserLevel.current !== null && s.user_level > prevUserLevel.current) {
          pushCelebration({
            kind: "user",
            title: `Nivel ${s.user_level}`,
            subtitle: s.user_level_name,
          });
        }
      }
      prevSanctuary.current = s.sanctuary_level;
      prevUserLevel.current = s.user_level;
      setStats(s);
    },
    [pushCelebration]
  );

  const refreshStats = useCallback(
    async (celebrate = true) => {
      try {
        const s = await api.getSanctuaryStats();
        applyStats(s, celebrate);
      } catch {}
    },
    [applyStats]
  );

  useEffect(() => {
    Promise.all([
      api.getCreatures(),
      api.getMyCreatures(),
      api.getPetItems(),
      api.getPetInventory(),
      api.getSanctuaryStats(),
      api.getCreatureMarket(),
    ])
      .then(([c, mc, items, inv, s, mk]) => {
        setCreatures(c);
        setMyCreatures(mc);
        mc.forEach((uc) => {
          petLevels.current[uc.id] = uc.level;
        });
        setPetItems(items);
        setInventory(inv);
        applyStats(s, false);
        setMarket(mk);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [applyStats]);

  const refreshUser = async () => {
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {}
  };

  // Detect a pet level-up from an updated UserCreature and celebrate it.
  const detectPetLevelUp = (uc: UserCreature) => {
    const prev = petLevels.current[uc.id];
    if (prev !== undefined && uc.level > prev) {
      pushCelebration({
        kind: "pet",
        title: uc.creature?.name ?? "Tu mascota",
        subtitle: `Nivel ${uc.level} · ${uc.level_name}`,
      });
    }
    petLevels.current[uc.id] = uc.level;
  };

  const meetsRequirements = (c: Creature) => {
    if (!stats) return true;
    return (
      stats.user_level >= (c.required_user_level || 1) &&
      stats.sanctuary_level >= (c.required_sanctuary_level || 0)
    );
  };

  const handleAdopt = async (creature: Creature, petName?: string) => {
    setAdopting(creature.id);
    try {
      const adopted = await api.adoptCreature(creature.id, petName);
      petLevels.current[adopted.id] = adopted.level;
      setMyCreatures((prev) => [...prev, adopted]);
      await refreshUser();
      await refreshStats();
      setAdoptModal(null);
      setAdoptPetName("");
    } catch {
    } finally {
      setAdopting(null);
    }
  };

  const openAdoptModal = (creature: Creature) => {
    setAdoptModal(creature);
    setAdoptPetName("");
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
      await refreshStats();
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
      detectPetLevelUp(updated);
      setMyCreatures((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setInventory((prev) =>
        prev
          .map((r) => (r.id === item.id ? { ...r, quantity: r.quantity - 1 } : r))
          .filter((r) => r.quantity > 0)
      );
      setPicker(null);
      await refreshStats();
    } catch {
    } finally {
      setUsing(null);
    }
  };

  const handleListForSale = async (ucId: string) => {
    const price = parseInt(sellPrice) || 0;
    if (price <= 0) return;
    try {
      const updated = await api.listCreatureForSale(ucId, price);
      setMyCreatures((prev) => prev.map((c) => (c.id === ucId ? updated : c)));
      setSellFor(null);
      setSellPrice("");
    } catch {}
  };

  const handleUnlist = async (ucId: string) => {
    try {
      const updated = await api.unlistCreature(ucId);
      setMyCreatures((prev) => prev.map((c) => (c.id === ucId ? updated : c)));
    } catch {}
  };

  const handleBuyMarket = async (m: MarketCreature) => {
    setBuyingPet(m.id);
    try {
      const bought = await api.buyMarketCreature(m.id);
      petLevels.current[bought.id] = bought.level;
      setMyCreatures((prev) => [...prev, bought]);
      setMarket((prev) => prev.filter((x) => x.id !== m.id));
      await refreshUser();
      await refreshStats();
    } catch {
    } finally {
      setBuyingPet(null);
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
    shopType === "all" ? petItems : petItems.filter((i) => i.pet_type === shopType);
  const shopFoods = shopItems.filter((i) => i.kind === "food");
  const shopToys = shopItems.filter((i) => i.kind === "toy");

  return (
    <div className="min-h-content -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
      <LevelUpCelebration
        key={celebrations[0]?.id ?? "none"}
        event={celebrations[0] ?? null}
        onDone={() => setCelebrations((q) => q.slice(1))}
      />

      <div className="max-w-7xl mx-auto mb-10">
        <div className="bg-primary-fixed/30 border border-primary/20 rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <MaterialIcon name="pets" className="text-primary text-3xl" filled />
              <span className="text-primary text-label-sm uppercase tracking-[0.2em]">Hogwarts</span>
            </div>
            <h1 className="font-display text-headline-lg md:text-display-lg text-primary mb-2">
              La Menajeria Susurrante
            </h1>
            <p className="text-on-surface-variant text-body-md mb-6 max-w-xl">
              Cuida a tus companiones: con el tiempo tendran hambre y necesitaran carino. Sube su nivel, haz crecer tu santuario y comercia mascotas.
            </p>

            <div className="flex flex-wrap gap-4">
              {/* Sanctuary level */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-violet-500/20 min-w-[210px]">
                <MaterialIcon name="castle" className="text-violet-600 text-[1.6em]" filled />
                <div className="flex-1">
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Santuario</p>
                  <p className="text-title-md font-bold text-on-surface leading-tight">
                    Nivel {stats?.sanctuary_level ?? 0}
                    <span className="text-label-sm text-on-surface-variant font-normal"> / {stats?.sanctuary_max ?? 23}</span>
                  </p>
                  <div className="h-1.5 bg-violet-500/15 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${stats?.sanctuary_progress.percent ?? 0}%` }} />
                  </div>
                </div>
              </div>
              {/* User level */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-amber-500/20 min-w-[210px]">
                <MaterialIcon name="military_tech" className="text-amber-600 text-[1.6em]" filled />
                <div className="flex-1">
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Nivel Magico</p>
                  <p className="text-title-md font-bold text-on-surface leading-tight">
                    {stats?.user_level_name ?? "—"}
                    <span className="text-label-sm text-on-surface-variant font-normal"> · Nv {stats?.user_level ?? 1}</span>
                  </p>
                  <div className="h-1.5 bg-amber-500/15 rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.round((stats?.user_progress ?? 0) * 100)}%` }} />
                  </div>
                </div>
              </div>
              {/* Zerines */}
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-secondary/10">
                <MaterialIcon name="diamond" className="text-secondary text-[1.4em]" filled />
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Zerines</p>
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
            { id: "market", label: "Mercado", icon: "storefront" },
            { id: "shop", label: "Tienda", icon: "nutrition" },
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
              Criaturas Disponibles para Adopcion
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
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {creatures.map((creature) => {
                  const isAdopted = adoptedIds.has(creature.id);
                  const meets = meetsRequirements(creature);
                  return (
                    <CreatureCard
                      key={creature.id}
                      creature={creature}
                      isAdopted={isAdopted}
                      meetsRequirements={meets}
                      stats={stats}
                      onAdopt={() => openAdoptModal(creature)}
                      adopting={adopting === creature.id}
                    />
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
                  <div key={i} className="bg-white border border-outline-variant/30 rounded-3xl p-6 animate-pulse">
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
                  <MaterialIcon name="add" className="text-on-surface-variant text-4xl mb-2" />
                  <p className="text-on-surface-variant text-body-md">Adopta tu primera criatura</p>
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
                    <PetCard
                      key={uc.id}
                      uc={uc}
                      petType={petType}
                      mood={mood}
                      isFeedOpen={isFeedOpen}
                      isPlayOpen={isPlayOpen}
                      foods={foods}
                      toys={toys}
                      onToggleFeed={() => setPicker(isFeedOpen ? null : { ucId: uc.id, mode: "feed" })}
                      onTogglePlay={() => setPicker(isPlayOpen ? null : { ucId: uc.id, mode: "play" })}
                      onUse={handleUse}
                      onListForSale={handleListForSale}
                      onUnlist={handleUnlist}
                      onToggleSale={(id: string) => { setSellFor(sellFor === id ? null : id); setSellPrice(""); }}
                      onGoToShop={() => setActiveTab("shop")}
                      sellFor={sellFor}
                      sellPrice={sellPrice}
                      setSellPrice={setSellPrice}
                      using={using}
                    />
                  );
                })}

                <button
                  onClick={() => setActiveTab("adopt")}
                  className="border-2 border-dashed border-outline-variant/50 rounded-3xl flex flex-col items-center justify-center py-16 cursor-pointer hover:border-primary/30 transition-colors"
                >
                  <MaterialIcon name="add" className="text-on-surface-variant text-4xl mb-2" />
                  <p className="text-on-surface-variant text-body-md">Adoptar otra criatura</p>
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "market" && (
          <>
            <h2 className="font-display text-headline-lg text-primary mb-6">
              Mercado de Mascotas
            </h2>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => <div key={i} className="glass-card rounded-3xl p-6 animate-pulse h-64" />)}
              </div>
            ) : market.length === 0 ? (
              <div className="text-center py-20">
                <MaterialIcon name="storefront" className="text-on-surface-variant text-6xl block mb-4" />
                <p className="text-on-surface-variant text-body-md">Nadie ha puesto mascotas en venta ahora mismo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {market.map((m) => {
                  const meets = m.creature ? meetsRequirements(m.creature) : true;
                  return (
                    <MarketCreatureCard
                      key={m.id}
                      market={m}
                      meetsRequirements={meets}
                      onBuy={() => handleBuyMarket(m)}
                      buying={buyingPet === m.id}
                      userZerines={user?.zerines ?? 0}
                    />
                  );
                })}
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
                {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="glass-card rounded-2xl p-5 animate-pulse h-32" />)}
              </div>
            ) : (
              <div className="space-y-10">
                <ShopSection title="Comida" icon="nutrition" items={shopFoods} inventory={inventory} buying={buying} onBuy={handleBuy} statLabel="hambre" />
                <ShopSection title="Juguetes" icon="toys" items={shopToys} inventory={inventory} buying={buying} onBuy={handleBuy} statLabel="felicidad" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Adopt modal — name input */}
      {adoptModal && (
        <Modal open onClose={() => { setAdoptModal(null); setAdoptPetName(""); }}>
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 mb-1">
              <MaterialIcon name="pets" className="text-primary text-2xl" filled />
              <h2 className="font-display text-headline-lg text-on-surface">
                Adoptar a {adoptModal.name}
              </h2>
            </div>
            <p className="text-on-surface-variant text-body-md">
              Ponle un nombre a tu nueva companera. Si lo dejas vacio, se quedara con el nombre de la especie.
            </p>
            <div>
              <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                Nombre personalizado (opcional)
              </label>
              <input
                type="text"
                autoFocus
                maxLength={40}
                value={adoptPetName}
                onChange={(e) => setAdoptPetName(e.target.value)}
                placeholder={adoptModal.name}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
              />
              <p className="text-label-sm text-on-surface-variant mt-1">
                Max. 40 caracteres
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => { setAdoptModal(null); setAdoptPetName(""); }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                disabled={adopting === adoptModal.id}
                onClick={() => handleAdopt(adoptModal, adoptPetName.trim() || undefined)}
                className="flex-1"
              >
                {adopting === adoptModal.id ? "Adoptando..." : "Adoptar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api, Creature, UserCreature } from "@/lib/api";
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

export default function PetsPage() {
  const { user } = useAuthStore();
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [myCreatures, setMyCreatures] = useState<UserCreature[]>([]);
  const [loading, setLoading] = useState(true);
  const [adopting, setAdopting] = useState<string | null>(null);
  const [feeding, setFeeding] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("adopt");

  useEffect(() => {
    Promise.all([api.getCreatures(), api.getMyCreatures()])
      .then(([c, mc]) => {
        setCreatures(c);
        setMyCreatures(mc);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdopt = async (creatureId: string) => {
    setAdopting(creatureId);
    try {
      const adopted = await api.adoptCreature(creatureId);
      setMyCreatures((prev) => [...prev, adopted]);
    } catch {
    } finally {
      setAdopting(null);
    }
  };

  const handleFeed = async (userCreatureId: string) => {
    setFeeding(userCreatureId);
    try {
      const updated = await api.feedCreature(userCreatureId);
      setMyCreatures((prev) =>
        prev.map((uc) => (uc.id === userCreatureId ? updated : uc))
      );
    } catch {
    } finally {
      setFeeding(null);
    }
  };

  const handlePlay = async (userCreatureId: string) => {
    setPlaying(userCreatureId);
    try {
      const updated = await api.playCreature(userCreatureId);
      setMyCreatures((prev) =>
        prev.map((uc) => (uc.id === userCreatureId ? updated : uc))
      );
    } catch {
    } finally {
      setPlaying(null);
    }
  };

  const adoptedIds = new Set(myCreatures.map((uc) => uc.creature_id));

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
              Encuentra tu companion magico. Cada criatura tiene su propia personalidad y habilidades unicas.
            </p>

            {/* Stats Row */}
            <div className="flex flex-wrap gap-4">
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-primary/10">
                <span className="material-symbols-outlined text-primary text-[1.4em]" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                  pets
                </span>
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Total Criaturas</p>
                  <p className="text-title-md font-bold text-on-surface">{creatures.length}</p>
                </div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-secondary/10">
                <span className="material-symbols-outlined text-secondary text-[1.4em]" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                  star
                </span>
                <div>
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Nivel del Santuario</p>
                  <p className="text-title-md font-bold text-on-surface">
                    {Math.floor(myCreatures.reduce((sum, uc) => sum + uc.level, 0) / Math.max(myCreatures.length, 1))}
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
            { id: "adopt", label: "Adoptar", icon: "pets" },
            { id: "mine", label: "Mis Mascotas", icon: "favorite" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
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
          ) : creatures.length === 0 ? (
            <div className="text-center py-20">
              <span
                className="material-symbols-outlined text-on-surface-variant text-6xl block mb-4"
                style={{
                  fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                }}
              >
                cage
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
              <div className="border-2 border-dashed border-outline-variant/50 rounded-3xl flex flex-col items-center justify-center py-16 cursor-pointer hover:border-primary/30 transition-colors">
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
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {myCreatures.map((uc) => (
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
                    <div>
                      <h4 className="font-display text-title-md text-on-surface">
                        {uc.creature?.name}
                      </h4>
                      <p className="text-label-sm text-on-surface-variant">
                        Guardian Nivel {uc.level}
                      </p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="space-y-3 mb-5">
                    <ProgressBar
                      value={uc.hunger}
                      max={100}
                      color="success"
                      label="Hambre"
                      showValue
                    />
                    <ProgressBar
                      value={uc.happiness}
                      max={100}
                      color="primary"
                      label="Felicidad"
                      showValue
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleFeed(uc.id)}
                      disabled={feeding === uc.id}
                      className="flex-1 flex items-center justify-center gap-2 border border-success text-success rounded-xl py-2 text-label-sm font-bold hover:bg-success hover:text-on-success transition-all active:scale-95 disabled:opacity-50"
                    >
                      <span
                        className="material-symbols-outlined text-[1.1em]"
                        style={{
                          fontVariationSettings:
                            '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                        }}
                      >
                        restaurant
                      </span>
                      {feeding === uc.id ? "..." : "Alimentar"}
                    </button>
                    <button
                      onClick={() => handlePlay(uc.id)}
                      disabled={playing === uc.id}
                      className="flex-1 flex items-center justify-center gap-2 border border-primary text-primary rounded-xl py-2 text-label-sm font-bold hover:bg-primary hover:text-on-primary transition-all active:scale-95 disabled:opacity-50"
                    >
                      <span
                        className="material-symbols-outlined text-[1.1em]"
                        style={{
                          fontVariationSettings:
                            '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                        }}
                      >
                        sports_esports
                      </span>
                      {playing === uc.id ? "..." : "Jugar"}
                    </button>
                  </div>
                </div>
              ))}

              {/* Empty slot */}
              <div className="border-2 border-dashed border-outline-variant/50 rounded-3xl flex flex-col items-center justify-center py-16 cursor-pointer hover:border-primary/30 transition-colors">
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
              </div>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}
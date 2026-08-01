"use client";

import { useState, useMemo } from "react";
import { TabGroup } from "@/components/ui";
import { LevelUpCelebration } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import { useFeatureFlag } from "@/lib/featureFlagStore";
import type { Creature, MarketCreature } from "@/lib/api";
import { usePetsData } from "./hooks/usePetsData";
import { usePetActions } from "./hooks/usePetActions";
import { usePetCelebrations } from "./hooks/usePetCelebrations";
import { useShopFilter } from "./hooks/useShopFilter";
import {
  PetsHeader,
  MyPetsTab,
  AdoptTab,
  MarketTab,
  ShopTab,
  AdoptModal,
  BuyMarketModal,
  type Picker,
} from "./components";

export default function PetsPage() {
  const { user, setUser } = useAuthStore();
  const showMarket = useFeatureFlag("pets.market");

  const [activeTab, setActiveTab] = useState("mine");
  const [picker, setPicker] = useState<Picker>(null);
  const [sellFor, setSellFor] = useState<string | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  // Modal de nombre al adoptar
  const [adoptModal, setAdoptModal] = useState<Creature | null>(null);
  const [adoptPetName, setAdoptPetName] = useState("");
  // Modal de confirmación para comprar en el mercado
  const [buyMarketModal, setBuyMarketModal] = useState<MarketCreature | null>(null);

  const petsData = usePetsData();
  const celebrations = usePetCelebrations();
  const shopFilter = useShopFilter(petsData.petItems);

  const validActiveTab =
    activeTab === "market" && !showMarket ? "mine" : activeTab;

  const petActions = usePetActions({
    myCreatures: petsData.myCreatures,
    setMyCreatures: petsData.setMyCreatures,
    inventory: petsData.inventory,
    setInventory: petsData.setInventory,
    market: petsData.market,
    setMarket: petsData.setMarket,
    user,
    setUser,
    refreshStats: petsData.refreshStats,
    refreshUser: petsData.refreshUser,
    petLevels: celebrations.petLevels,
    pushCelebration: celebrations.pushCelebration,
    sellPrice,
  });

  const adoptedIds = useMemo(
    () => new Set(petsData.myCreatures.map((uc) => uc.creature_id)),
    [petsData.myCreatures]
  );

  return (
    <div className="min-h-content -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
      <LevelUpCelebration
        key={celebrations.celebrations[0]?.id ?? "none"}
        event={celebrations.celebrations[0] ?? null}
        onDone={() => celebrations.setCelebrations((q) => q.slice(1))}
      />

      <PetsHeader stats={petsData.stats} user={user} />

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8">
        <TabGroup
          tabs={[
            { id: "mine", label: "Mis Mascotas", icon: "favorite" },
            { id: "adopt", label: "Adoptar", icon: "pets" },
            ...(showMarket ? [{ id: "market", label: "Mercado", icon: "storefront" }] : []),
            { id: "shop", label: "Tienda", icon: "nutrition" },
          ]}
          activeTab={validActiveTab}
          onChange={(t) => {
            setActiveTab(t);
            setPicker(null);
          }}
        />
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {validActiveTab === "adopt" && (
          <AdoptTab
            creatures={petsData.creatures}
            loading={petsData.loading}
            loadError={petsData.loadError}
            adoptedIds={adoptedIds}
            stats={petsData.stats}
            adopting={petActions.adopting}
            userZerines={user?.zerines ?? 0}
            onAdopt={(creature) => {
              setAdoptModal(creature);
              setAdoptPetName("");
            }}
            onRetry={() => {
              petsData.setLoadError(null);
              petsData.setLoading(true);
              window.location.reload();
            }}
          />
        )}

        {validActiveTab === "mine" && (
          <MyPetsTab
            myCreatures={petsData.myCreatures}
            loading={petsData.loading}
            loadingMore={petsData.loadingMoreMy}
            hasMore={petsData.myCreaturesHasMore}
            inventory={petsData.inventory}
            picker={picker}
            using={petActions.using}
            sellFor={sellFor}
            sellPrice={sellPrice}
            showMarket={showMarket}
            stats={petsData.stats}
            onToggleFeed={(ucId) => setPicker((p) => (p?.ucId === ucId && p.mode === "feed" ? null : { ucId, mode: "feed" }))}
            onTogglePlay={(ucId) => setPicker((p) => (p?.ucId === ucId && p.mode === "play" ? null : { ucId, mode: "play" }))}
            onUse={petActions.handleUse}
            onListForSale={petActions.handleListForSale}
            onUnlist={petActions.handleUnlist}
            onToggleSale={(id: string) => setSellFor(sellFor === id ? null : id)}
            onGoToShop={() => setActiveTab("shop")}
            onLoadMore={petsData.loadMoreMyCreatures}
            setSellPrice={setSellPrice}
          />
        )}

        {validActiveTab === "market" && (
          <MarketTab
            market={petsData.market}
            loading={petsData.loading}
            loadingMore={petsData.loadingMoreMarket}
            hasMore={petsData.marketHasMore}
            buyingPet={petActions.buyingPet}
            userZerines={user?.zerines ?? 0}
            stats={petsData.stats}
            onBuy={(m) => setBuyMarketModal(m)}
            onLoadMore={petsData.loadMoreMarket}
          />
        )}

        {validActiveTab === "shop" && (
          <ShopTab
            petItems={petsData.petItems}
            inventory={petsData.inventory}
            loading={petsData.loading}
            buying={petActions.buying}
            shopType={shopFilter.shopType}
            petTypeValues={petsData.petTypeValues}
            onShopTypeChange={shopFilter.setShopType}
            onBuy={petActions.handleBuy}
          />
        )}
      </div>

      {/* Adopt modal — name input */}
      <AdoptModal
        creature={adoptModal}
        adopting={petActions.adopting}
        petName={adoptPetName}
        onClose={() => {
          setAdoptModal(null);
          setAdoptPetName("");
        }}
        onNameChange={setAdoptPetName}
        onConfirm={(petName) => petActions.handleAdopt(adoptModal!, petName)}
      />

      {/* Buy market creature modal — confirmation */}
      <BuyMarketModal
        marketCreature={buyMarketModal}
        buyingPet={petActions.buyingPet}
        userZerines={user?.zerines ?? 0}
        onClose={() => setBuyMarketModal(null)}
        onConfirm={() => petActions.handleBuyMarket(buyMarketModal!)}
      />
    </div>
  );
}
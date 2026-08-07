"use client";

import { useState, useMemo } from "react";
import { TabGroup, DetailModal } from "@/components/ui";
import { LevelUpCelebration } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import { useFeatureFlag } from "@/lib/featureFlagStore";
import type { Creature, MarketCreature, PetItem, UserCreature } from "@/lib/api";
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
import {
  CreatureDetailContent,
  PetItemDetailContent,
  MyPetDetailContent,
} from "@/components/domain/Pets";

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
  // Detail modals
  const [detailCreature, setDetailCreature] = useState<Creature | null>(null);
  const [detailMarketCreature, setDetailMarketCreature] = useState<MarketCreature | null>(null);
  const [detailPetItem, setDetailPetItem] = useState<PetItem | null>(null);
  const [detailMyPet, setDetailMyPet] = useState<UserCreature | null>(null);

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
            onViewDetails={setDetailCreature}
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
            onViewDetails={setDetailMyPet}
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
            onViewDetails={setDetailMarketCreature}
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
            onViewDetails={setDetailPetItem}
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

      {/* Creature Detail Modal (Adopt tab) */}
      <DetailModal
        open={!!detailCreature}
        onClose={() => setDetailCreature(null)}
        title={detailCreature?.name}
        theme="light"
        size="md"
      >
        {detailCreature && (
          <CreatureDetailContent
            creature={detailCreature}
            stats={petsData.stats}
            onAdopt={() => {
              setAdoptModal(detailCreature);
              setAdoptPetName("");
            }}
            userZerines={user?.zerines ?? 0}
          />
        )}
      </DetailModal>

      {/* Market Creature Detail Modal (Market tab) */}
      <DetailModal
        open={!!detailMarketCreature}
        onClose={() => setDetailMarketCreature(null)}
        title={detailMarketCreature?.creature?.name ?? "Detalle"}
        theme="light"
        size="md"
      >
        {detailMarketCreature && (
          <CreatureDetailContent
            creature={detailMarketCreature.creature!}
            market={detailMarketCreature}
            stats={petsData.stats}
            meetsRequirements={
              !!(
                petsData.stats &&
                detailMarketCreature.creature &&
                petsData.stats.user_level >= (detailMarketCreature.creature.required_user_level || 1) &&
                petsData.stats.sanctuary_level >= (detailMarketCreature.creature.required_sanctuary_level || 0)
              )
            }
            onBuy={() => setBuyMarketModal(detailMarketCreature)}
            userZerines={user?.zerines ?? 0}
          />
        )}
      </DetailModal>

      {/* Pet Item Detail Modal (Shop tab) */}
      <DetailModal
        open={!!detailPetItem}
        onClose={() => setDetailPetItem(null)}
        title={detailPetItem?.name}
        theme="light"
        size="md"
      >
        {detailPetItem && (
          <PetItemDetailContent
            item={detailPetItem}
            inventoryQuantity={petsData.inventory.find((r) => r.pet_item_id === detailPetItem.id)?.quantity ?? 0}
            onBuy={petActions.handleBuy}
            statLabel={detailPetItem.kind === "food" ? "hambre" : "felicidad"}
          />
        )}
      </DetailModal>

      {/* My Pet Detail Modal (My Pets tab) */}
      <DetailModal
        open={!!detailMyPet}
        onClose={() => setDetailMyPet(null)}
        title={detailMyPet?.pet_name ?? detailMyPet?.creature?.name ?? "Detalle"}
        theme="light"
        size="lg"
      >
        {detailMyPet && (
          <MyPetDetailContent
            userCreature={detailMyPet}
            petType={detailMyPet.creature?.pet_type ?? "Desconocido"}
            onFeed={() => setPicker({ ucId: detailMyPet.id, mode: "feed" })}
            onPlay={() => setPicker({ ucId: detailMyPet.id, mode: "play" })}
            onGoToShop={() => setActiveTab("shop")}
          />
        )}
      </DetailModal>
    </div>
  );
}
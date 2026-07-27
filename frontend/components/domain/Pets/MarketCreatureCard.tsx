"use client";

import { Avatar, ZerineDisplay, Button } from "@/components/ui";
import { MarketCreature } from "@/lib/api";

const STAGE_LABELS: Record<string, string> = {
  cria: "Cría",
  joven: "Joven",
  adulta: "Adulta",
  anciana: "Anciana",
};

interface MarketCreatureCardProps {
  market: MarketCreature;
  meetsRequirements: boolean;
  onBuy: () => void;
  buying: boolean;
  userZerines: number;
}

export function MarketCreatureCard({
  market,
  meetsRequirements,
  onBuy,
  buying,
  userZerines,
}: MarketCreatureCardProps) {
  return (
    <div className="glass-card rounded-3xl p-6">
      <div className="flex items-center gap-4 mb-4">
        <Avatar src={market.creature?.image_url} alt={market.creature?.name} size="lg" borderColor="secondary" initials={market.creature?.name?.charAt(0) ?? "?"} />
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-title-md text-on-surface truncate">{market.creature?.name}</h4>
          <p className="text-label-sm text-primary font-semibold">Nv {market.level} · {market.level_name}</p>
          <p className="text-label-sm text-on-surface-variant">{STAGE_LABELS[market.stage] ?? market.stage} · Vende: {market.seller_name}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <ZerineDisplay amount={market.sale_price} iconStyle="icon" variant="price" />
        <Button
          onClick={onBuy}
          disabled={buying || !meetsRequirements || userZerines < market.sale_price}
          title={meetsRequirements ? "" : "No cumples el nivel requerido"}
          variant="secondary"
        >
          {buying ? "Comprando..." : meetsRequirements ? "Comprar" : "Bloqueada"}
        </Button>
      </div>
    </div>
  );
}
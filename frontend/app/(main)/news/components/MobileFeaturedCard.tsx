"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Article } from "@/lib/api";
import { Badge, Button, GlassCard, MaterialIcon } from "@/components/ui";
import { isLocalUpload } from "../utils";

interface MobileFeaturedCardProps {
  article: Article | null;
}

export function MobileFeaturedCard({ article }: MobileFeaturedCardProps) {
  const router = useRouter();

  if (!article) {
    return (
      <GlassCard className="p-8 text-center">
        <MaterialIcon
          name="newspaper"
          className="text-5xl text-outline-variant mb-3"
        />
        <p className="text-on-surface-variant text-body-md">
          Sin edicion hoy
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="parchment-texture rounded-2xl overflow-hidden border border-secondary/10">
      {article.image_url && (
        <div className="relative h-48 overflow-hidden">
          <Image
            src={article.image_url}
            alt={article.title}
            fill
            className="object-cover"
            sizes="100vw"
            unoptimized={isLocalUpload(article.image_url)}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
        </div>
      )}
      <div className="p-5">
        <div className="mb-3">
          <Badge variant="rarity" color="secondary">
            Exclusivo
          </Badge>
        </div>
        <h2 className="font-display text-headline-lg-mobile text-on-surface leading-tight mb-2">
          {article.title}
        </h2>
        <p className="text-label-sm text-on-surface-variant mb-4 line-clamp-2">
          {article.body.slice(0, 150)}...
        </p>
        <Button
          variant="secondary"
          icon="arrow_forward"
          iconPosition="right"
          size="sm"
          onClick={() => router.push(`/news/${article.id}`)}
        >
          Leer Mas
        </Button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Article } from "@/lib/api";
import { Badge, Button, GlassCard, MaterialIcon } from "@/components/ui";
import { formatDate } from "../utils";

interface MobileHeadlinesProps {
  articles: Article[];
}

export function MobileHeadlines({ articles }: MobileHeadlinesProps) {
  const router = useRouter();

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-title-md text-on-surface flex items-center gap-2">
          <MaterialIcon name="bolt" className="text-secondary" filled />
          Titulares
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/news/all")}
          className="text-primary font-medium"
        >
          Ver todos
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {articles.slice(0, 4).map((a) => (
          <Link key={a.id} href={`/news/${a.id}`} className="block">
            <GlassCard className="p-4 h-full" hover glow>
              <div className="mb-2">
                <Badge variant="tag" color="secondary">
                  {a.category}
                </Badge>
              </div>
              <h3 className="font-display text-body-md text-on-surface leading-snug line-clamp-3">
                {a.title}
              </h3>
              <p className="text-label-sm text-on-surface-variant mt-2">
                {formatDate(a.created_at)}
              </p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

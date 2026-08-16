"use client";

import { User } from "@/lib/api";
import { GlassCard } from "@/components/ui";

interface BioSectionProps {
  profile: User;
}

export function BioSection({ profile }: BioSectionProps) {
  if (!profile.bio) return null;

  return (
    <GlassCard className="px-6 py-5 md:px-8">
      <p className="font-display font-medium italic text-title-md text-on-surface leading-snug whitespace-pre-line">
        <span className="text-[#c9a227] select-none">“</span>
        {profile.bio}
        <span className="text-[#c9a227] select-none">”</span>
      </p>
    </GlassCard>
  );
}
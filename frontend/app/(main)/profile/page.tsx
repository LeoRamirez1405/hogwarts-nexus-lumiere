"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.id) {
      router.replace(`/profile/${user.id}`);
    } else {
      router.replace("/login");
    }
  }, [user, router]);

  return (
    <div className="flex items-center justify-center py-24">
      <p className="text-on-surface-variant text-body-md">Redirigiendo...</p>
    </div>
  );
}

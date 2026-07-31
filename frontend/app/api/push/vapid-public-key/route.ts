import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/push/vapid-public-key`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { detail: "Push not configured" },
        { status: 503 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (_error) {
    return NextResponse.json(
      { detail: "Failed to fetch VAPID key" },
      { status: 500 }
    );
  }
}
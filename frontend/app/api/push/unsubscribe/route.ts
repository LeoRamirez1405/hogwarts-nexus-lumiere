import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const cookieHeader = request.headers.get("cookie");

    const res = await fetch(`${API_BASE}/push/unsubscribe`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { detail: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
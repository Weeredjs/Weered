import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_BASE || "https://api.weered.ca";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const qs = req.nextUrl.search || "";
  return NextResponse.redirect(`${API}/auth/poe/callback${qs}`);
}

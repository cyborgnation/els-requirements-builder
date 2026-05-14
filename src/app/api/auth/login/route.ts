import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await setAuthCookie();
  return NextResponse.json({ ok: true });
}

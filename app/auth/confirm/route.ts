import { NextResponse, type NextRequest } from "next/server";
import { safePath } from "@/lib/forms";
import { serverDb } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const code = query.get("code");
  const tokenHash = query.get("token_hash");
  const type = query.get("type");
  const db = await serverDb();
  if (db) {
    const result = code ? await db.auth.exchangeCodeForSession(code)
      : tokenHash && (type === "email" || type === "signup" || type === "recovery")
        ? await db.auth.verifyOtp({ token_hash: tokenHash, type }) : null;
    if (result && !result.error) {
      return NextResponse.redirect(new URL(safePath(query.get("next") ?? undefined), request.url));
    }
  }
  return NextResponse.redirect(new URL("/account?expired=1", request.url));
}

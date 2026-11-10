import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  function forward() {
    const headers = new Headers(request.headers);
    headers.set("x-obsidian-request-path", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.next({ request: { headers } });
  }
  let response = forward();
  if (!url || !key) return response;
  const auth = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (updates) => {
        for (const { name, value } of updates) request.cookies.set(name, value);
        response = forward();
        for (const { name, value, options } of updates) response.cookies.set(name, value, options);
      },
    },
  });
  await auth.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/account/:path*", "/apply/:path*", "/auth/:path*", "/services/interior-design", "/services/advanced-networking", "/api/documents/:path*", "/api/course-materials/:path*", "/api/interior-renders/:path*", "/api/payments/callback"],
};

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake can make it very hard to debug
  // auth issues.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ip = request.headers.get("x-forwarded-for") || (request as any).ip || "unknown";

  // 1. Lockout Check (Brute Force Protection)
  if (request.nextUrl.pathname.startsWith("/sudo-onboard")) {
    const { data: lockout } = await supabase
      .from("login_attempts")
      .select("lockout_until")
      .eq("ip_address", ip)
      .maybeSingle();

    if (lockout?.lockout_until && new Date(lockout.lockout_until) > new Date()) {
      return new NextResponse(null, { status: 404 });
    }
  }

  // 2. Authorization & Stealth 404
  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      return new NextResponse(null, { status: 404 });
    }
  }

  // 3. Simple Redirect
  if (user && request.nextUrl.pathname === "/sudo-onboard") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

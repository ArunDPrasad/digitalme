import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  const supabase = await createClient();
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  // 1. Check if already locked out (Middleware handles this too, but double check)
  const { data: lockout } = await supabase
    .from("login_attempts")
    .select("lockout_until")
    .eq("ip_address", ip)
    .maybeSingle();

  if (lockout?.lockout_until && new Date(lockout.lockout_until) > new Date()) {
    return NextResponse.json({ error: "Access Denied. Identity Locked." }, { status: 403 });
  }

  // 2. Attempt Login
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Record Failure via RPC (PostgreSQL Function)
    await supabase.rpc("record_login_failure", { target_ip: ip });
    return NextResponse.json({ error: "Invalid Credentials" }, { status: 401 });
  }

  // 3. Success - Reset attempts
  await supabase.rpc("reset_login_attempts", { target_ip: ip });

  return NextResponse.json({ success: true });
}

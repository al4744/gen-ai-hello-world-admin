
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  function redirectWithError(error: string) {
    const destination = new URL("/", request.url);
    destination.searchParams.set("auth_error", error);
    return NextResponse.redirect(destination);
  }

  if (!code) {
    return redirectWithError("authentication_failed");
  }

  const supabase = await createClient();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return redirectWithError("authentication_failed");
  }

  // Verify the user with Supabase Auth.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirectWithError("authentication_failed");
  }

  // Require a Google identity and an explicitly approved admin.
  const hasGoogleIdentity =
    user.identities?.some(
      (identity) => identity.provider === "google"
    ) === true;

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle();

  if (
    !hasGoogleIdentity ||
    profileError ||
    profile?.is_superadmin !== true
  ) {
    await supabase.auth.signOut();
    return redirectWithError("access_denied");
  }

  // The home page will send approved admins to the dashboard.
  return NextResponse.redirect(new URL("/", request.url));
}


import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireSuperadmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/");
  }

  const hasGoogleIdentity =
    user.identities?.some(
      (identity) => identity.provider === "google"
    ) === true;

  if (!hasGoogleIdentity) {
    redirect("/?auth_error=access_denied");
  }

  const { data: profile, error: profileError } =
    await supabase
      .from("profiles")
      .select("is_superadmin")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError || profile?.is_superadmin !== true) {
    redirect("/?auth_error=access_denied");
  }

  return { supabase, user };
}

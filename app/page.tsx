
import { redirect } from "next/navigation";
import GoogleSignIn from "@/components/google-sign-in";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type HomePageProps = {
  searchParams: Promise<{
    auth_error?: string;
  }>;
};

export default async function HomePage({
  searchParams,
}: HomePageProps) {
  const { auth_error } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let authorized = false;

  if (user) {
    const hasGoogleIdentity =
      user.identities?.some(
        (identity) => identity.provider === "google"
      ) === true;

    if (hasGoogleIdentity) {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", user.id)
        .maybeSingle();

      authorized =
        !error && profile?.is_superadmin === true;
    }
  }

  if (authorized) {
    redirect("/dashboard");
  }

  const accessDenied =
    auth_error === "access_denied" || !!user;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-md space-y-6 rounded-2xl border p-8 text-center">
        <p className="text-sm font-medium text-gray-500">
          CAPTION ARENA
        </p>

        <h1 className="text-3xl font-bold">
          Admin Panel
        </h1>

        {accessDenied ? (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">
              Access denied
            </h2>
            <p className="text-sm text-gray-500">
              This Google account is not authorized
              to access Caption Arena Admin.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Sign in with an authorized Google account
            to access the administration dashboard.
          </p>
        )}

        {!user && <GoogleSignIn />}
      </section>
    </main>
  );
}

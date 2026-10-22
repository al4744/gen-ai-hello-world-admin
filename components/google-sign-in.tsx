"use client";

import { createClient } from "@/lib/supabase/client";

export default function GoogleSignIn() {
  async function signInWithGoogle() {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Google sign-in failed:", error.message);
    }
  }

  return (
    <button
      onClick={signInWithGoogle}
      className="rounded-lg border px-4 py-2 font-medium"
    >
      Continue with Google
    </button>
  );
}
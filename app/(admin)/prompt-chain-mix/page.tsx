import { redirect } from "next/navigation";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const instant = false;

type PageProps = {
  searchParams: Promise<{
    updated?: string;
    error?: string;
  }>;
};

export default async function PromptChainMixPage({ searchParams }: PageProps) {
  await connection();
  await requireSuperadmin();

  // Preserve feedback from bookmarked URLs and older form submissions.
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.updated === "1") query.set("updated", "1");
  if (params.error === "last-active") query.set("error", "last-active");

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  redirect(`/prompt-chains${suffix}#mix-configuration`);
}

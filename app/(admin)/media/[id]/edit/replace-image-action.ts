
"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

const BUCKET = "generation-media";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type ReplacementResult =
  | { ok: true; cleanupFailed: boolean }
  | { ok: false; error: string };

function validImage(
  bytes: Uint8Array,
  extension: string
): boolean {
  const jpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;

  const png =
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value
    );

  const webp =
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";

  return (
    ((extension === "jpg" || extension === "jpeg") && jpeg) ||
    (extension === "png" && png) ||
    (extension === "webp" && webp)
  );
}

export async function replaceBattleImage(
  formData: FormData
): Promise<ReplacementResult> {
  // Authorization is checked for every replacement.
  const { user, supabase } = await requireSuperadmin();

  const rawBattleId = formData.get("battleId");
  const rawNewPath = formData.get("newImagePath");
  const rawExpectedPath = formData.get("expectedImagePath");
  const confirmation = formData.get("confirmation");

  if (confirmation !== "REPLACE IMAGE") {
    return {
      ok: false,
      error: "Image replacement confirmation is required.",
    };
  }

  if (
    typeof rawBattleId !== "string" ||
    !/^[1-9]\d*$/.test(rawBattleId)
  ) {
    return { ok: false, error: "Invalid battle ID." };
  }

  const battleId = Number(rawBattleId);

  if (!Number.isSafeInteger(battleId)) {
    return { ok: false, error: "Invalid battle ID." };
  }

  if (
    typeof rawNewPath !== "string" ||
    typeof rawExpectedPath !== "string"
  ) {
    return { ok: false, error: "Invalid replacement request." };
  }

  // A replacement must be a uniquely named file belonging to
  // the currently authenticated administrator's upload folder.
  const prefix = `${user.id}/`;

  if (!rawNewPath.startsWith(prefix)) {
    return {
      ok: false,
      error: "Replacement image must belong to your upload folder.",
    };
  }

  const filename = rawNewPath.slice(prefix.length);

  const match = filename.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|jpeg|png|webp)$/i
  );

  if (!match) {
    return {
      ok: false,
      error: "Invalid replacement image path.",
    };
  }

  const newImagePath: string = rawNewPath;
  const storage = supabase.storage.from(BUCKET);

  async function cleanupNewImage() {
    const { error } = await storage.remove([newImagePath]);

    if (error) {
      console.error("Replacement upload cleanup failed:", error);
    }
  }

  // Verify the uploaded object exists and actually contains
  // a supported image, rather than trusting browser metadata.
  const { data: imageBlob, error: downloadError } =
    await storage.download(rawNewPath);

  if (downloadError || !imageBlob) {
    if (downloadError) console.error("Replacement image download failed:", downloadError);
    return {
      ok: false,
      error: "Replacement image could not be verified.",
    };
  }

  if (
    imageBlob.size === 0 ||
    imageBlob.size > MAX_IMAGE_BYTES
  ) {
    await cleanupNewImage();

    return {
      ok: false,
      error: "Image must be no larger than 5 MB.",
    };
  }

  const bytes = new Uint8Array(
    await imageBlob.slice(0, 16).arrayBuffer()
  );

  if (!validImage(bytes, match[2].toLowerCase())) {
    await cleanupNewImage();

    return {
      ok: false,
      error: "Only valid JPEG, PNG, or WebP images are allowed.",
    };
  }

  // Read the battle and its current image path.
  const { data: battle, error: readError } = await supabase
    .from("generation_sets")
    .select("id, image_path")
    .eq("id", battleId)
    .maybeSingle();

  if (readError || !battle) {
    if (readError) console.error("Replacement battle lookup failed:", readError);
    await cleanupNewImage();

    return {
      ok: false,
      error: readError ? "Unable to load this battle. Please try again." : "Battle not found.",
    };
  }

  const oldPath: string | null = battle.image_path ?? null;

  // Detect changes made by another administrator.
  if ((oldPath ?? "") !== rawExpectedPath) {
    await cleanupNewImage();

    return {
      ok: false,
      error: "The battle image has changed. Refresh and try again.",
    };
  }

  if (oldPath === rawNewPath) {
    return {
      ok: false,
      error: "Replacement must use a different image path.",
    };
  }

  // Atomically update only if the old image path still matches.
  // This prevents two concurrent replacements from silently
  // overwriting each other.
  const updateQuery = supabase
    .from("generation_sets")
    .update({ image_path: rawNewPath })
    .eq("id", battleId);

  const { data: updated, error: updateError } = oldPath
    ? await updateQuery
        .eq("image_path", oldPath)
        .select("id")
        .maybeSingle()
    : await updateQuery
        .is("image_path", null)
        .select("id")
        .maybeSingle();

  if (updateError || !updated) {
    console.error("Image replacement update failed:", updateError);

    await cleanupNewImage();

    return {
      ok: false,
      error: "Could not update the battle image. Please retry.",
    };
  }

  // The database now references the new image.
  // Any failure below must NOT reverse that successful update.
  let cleanupFailed = false;

  if (oldPath) {
    const { count, error: countError } = await supabase
      .from("generation_sets")
      .select("*", { count: "exact", head: true })
      .eq("image_path", oldPath);

    if (countError || count === null) {
      console.error("Old image reference check failed:", countError);
      cleanupFailed = true;
    } else if (count === 0) {
      // Do not delete an image used by another battle.
      const { error: removalError } = await storage.remove([
        oldPath,
      ]);

      if (removalError) {
        console.error("Old image cleanup failed:", removalError);
        cleanupFailed = true;
      }
    }
  }

  revalidatePath("/media");
  revalidatePath(`/media/${battleId}/edit`);
  revalidatePath("/dashboard");

  return { ok: true, cleanupFailed };
}

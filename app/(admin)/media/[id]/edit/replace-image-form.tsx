
"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { replaceBattleImage } from "./replace-image-action";

const MAX_SIZE = 5 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type Props = {
  battleId: number;
  userId: string;
  currentImagePath: string | null;
};

export default function ReplaceImageForm({
  battleId,
  userId,
  currentImagePath,
}: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (pending) return;

    setMessage("");
    setIsError(false);

    if (!file) {
      setMessage("Please select an image.");
      setIsError(true);
      return;
    }

    const extension = EXTENSIONS[file.type];

    if (!extension) {
      setMessage("Only JPEG, PNG, and WebP images are supported.");
      setIsError(true);
      return;
    }

    if (file.size === 0 || file.size > MAX_SIZE) {
      setMessage("Image must be nonempty and no larger than 5 MB.");
      setIsError(true);
      return;
    }

    if (!acknowledged) {
      setMessage("Please acknowledge the replacement warning.");
      setIsError(true);
      return;
    }

    const confirmed = window.confirm(
      `Replace the image for Battle #${battleId}?\n\n` +
        "Existing captions and votes will remain unchanged."
    );

    if (!confirmed) return;

    setPending(true);

    try {
      const supabase = createClient();

      // Use a unique path in the authenticated admin's folder.
      // Never overwrite the previous image.
      const newPath =
        `${userId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("generation-media")
        .upload(newPath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Replacement upload failed:", uploadError);
        setMessage("Could not upload the replacement image.");
        setIsError(true);
        return;
      }

      const formData = new FormData();

      formData.set("battleId", String(battleId));
      formData.set("newImagePath", newPath);
      formData.set(
        "expectedImagePath",
        currentImagePath ?? ""
      );
      formData.set("confirmation", "REPLACE IMAGE");

      const result = await replaceBattleImage(formData);

      if (!result.ok) {
        setMessage(result.error);
        setIsError(true);
        return;
      }

      setMessage(
        result.cleanupFailed
          ? "Image replaced successfully, but old image cleanup failed. Check Supabase Storage."
          : "Battle image replaced successfully."
      );
      setIsError(false);

      setFile(null);
      setAcknowledged(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      router.refresh();
    } catch (error) {
      console.error("Image replacement failed:", error);

      // Do not delete the uploaded object here:
      // the server may already have updated the database.
      setMessage(
        "The replacement result is uncertain. Refresh the page and verify the image before retrying."
      );
      setIsError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-10 rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.035] p-6">
      <h2 className="text-xl font-semibold">
        Replace Image
      </h2>

      <p className="mt-3 text-sm leading-6 text-gray-400">
        Upload a new image for this battle. The existing
        battle ID, captions, and votes will be preserved.
      </p>

      <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm leading-6 text-amber-200">
        Warning: Existing captions and historical votes
        were associated with the original image.
        Replacing it may make those records inconsistent
        with the new image.
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div>
          <label
            htmlFor="replacement-image"
            className="block text-sm font-medium"
          >
            Replacement image
          </label>

          <input
            ref={fileInputRef}
            id="replacement-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            disabled={pending}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setMessage("");
              setIsError(false);
            }}
            className="mt-3 block w-full cursor-pointer rounded-xl border border-white/20 bg-white/[0.04] p-3 text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-indigo-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />

          <p className="mt-2 text-xs text-gray-500">
            JPEG, PNG, or WebP. Maximum size: 5 MB.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={pending}
            onChange={(event) =>
              setAcknowledged(event.target.checked)
            }
            className="mt-1 h-4 w-4 accent-indigo-400"
          />

          <span>
            I understand that replacing the image does
            not regenerate captions or reset existing votes.
          </span>
        </label>

        <button
          type="submit"
          disabled={!file || !acknowledged || pending}
          className="cursor-pointer rounded-xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Replacing Image..." : "Replace Image"}
        </button>

        {message && (
          <p
            role={isError ? "alert" : "status"}
            className={`text-sm ${
              isError ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {message}
          </p>
        )}
      </form>
    </section>
  );
}

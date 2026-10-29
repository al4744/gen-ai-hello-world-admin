"use client";

import {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import InlineFormError from "./inline-form-error";

type GenerationFormProps = {
  userId: string;
};

type Generation = {
  id: number;
  candidate_index: number;
  content: string;
};

type GenerationResult = {
  generationSetId: number;
  imagePath: string;
  imageUrl: string;
  generations: Generation[];
};

type GenerationPhase = "uploading" | "generating" | null;

export default function GenerationForm({
  userId,
}: GenerationFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>(null);
  const [message, setMessage] = useState("");
  const [result, setResult] =
    useState<GenerationResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requestInFlightRef = useRef(false);
  // Retrying after an AI error should not upload the same file again.
  const uploadedImageRef = useRef<{ file: File; path: string } | null>(null);

  // Release temporary browser image URLs when changed or unmounted.
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function generateForFile(selectedFile: File) {
    // A synchronous ref prevents double requests (including repeated clicks,
    // drops, or React renders) before the loading state is painted.
    if (requestInFlightRef.current) {
      return;
    }

    requestInFlightRef.current = true;
    setGenerating(true);
    setMessage("");
    setResult(null);

    try {
      const supabase = createClient();
      let imagePath: string;

      if (uploadedImageRef.current?.file === selectedFile) {
        imagePath = uploadedImageRef.current.path;
        setPhase("generating");
      } else {
        setPhase("uploading");

        let extension = selectedFile.name.split(".").pop()?.toLowerCase();
        if (
          !extension ||
          !["jpg", "jpeg", "png", "webp"].includes(extension)
        ) {
          extension =
            selectedFile.type === "image/png"
              ? "png"
              : selectedFile.type === "image/webp"
                ? "webp"
                : "jpg";
        }

        imagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("generation-media")
          .upload(imagePath, selectedFile, {
            contentType: selectedFile.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("Image upload error:", uploadError);
          setMessage("Failed to upload image. Please try again.");
          return;
        }

        uploadedImageRef.current = { file: selectedFile, path: imagePath };
        setPhase("generating");
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath, userPrompt: "" }),
      });

      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const providerMessage =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Failed to generate captions. Please try again.";
        setMessage(providerMessage);
        return;
      }

      // Only switch to the completed view after the API confirms success
      // with an actual pair of captions.
      const candidate = data as Partial<GenerationResult> | null;
      if (
        !candidate ||
        typeof candidate.generationSetId !== "number" ||
        typeof candidate.imageUrl !== "string" ||
        !Array.isArray(candidate.generations) ||
        candidate.generations.length !== 2 ||
        !candidate.generations.every(
          (generation) =>
            generation &&
            typeof generation.content === "string" &&
            generation.content.trim().length > 0
        )
      ) {
        setMessage("Generation returned an incomplete result. Please retry.");
        return;
      }

      setResult(candidate as GenerationResult);
      setMessage("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Caption generation error:", error);
      setMessage("Could not generate captions. Please try again.");
    } finally {
      requestInFlightRef.current = false;
      setGenerating(false);
      setPhase(null);
    }
  }

  function acceptFile(selectedFile: File | null) {
    if (requestInFlightRef.current) {
      return;
    }

    if (!selectedFile) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(selectedFile.type)) {
      setFile(null);
      setPreviewUrl("");
      setResult(null);
      uploadedImageRef.current = null;
      setMessage("Please choose a JPEG, PNG, or WebP image.");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setFile(null);
      setPreviewUrl("");
      setResult(null);
      uploadedImageRef.current = null;
      setMessage("Image must be 5 MB or smaller.");
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setMessage("");
    uploadedImageRef.current = null;
    setPreviewUrl(URL.createObjectURL(selectedFile));
    // Generate exactly once in response to this user selection; not in an
    // effect that could run again on a rerender.
    void generateForFile(selectedFile);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;
    event.target.value = ""; // Allow selecting the same file again.
    acceptFile(selectedFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    acceptFile(event.dataTransfer.files?.[0] ?? null);
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    if (requestInFlightRef.current) {
      return;
    }

    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );
    if (!imageItem) {
      return;
    }

    event.preventDefault();
    acceptFile(imageItem.getAsFile());
  }

  function handleCreateAnother() {
    if (requestInFlightRef.current) {
      return;
    }

    setFile(null);
    setPreviewUrl("");
    setMessage("");
    setResult(null);
    uploadedImageRef.current = null;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-8">
      {!result && (
        <div className="space-y-6">
          {!generating && (
            <div>
              <p className="mb-2 font-medium">Image</p>

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                onPaste={handlePaste}
                tabIndex={0}
                className="rounded-xl border-2 border-dashed p-8 text-center"
              >
                <p className="font-medium">
                  Drop an image here to generate captions
                </p>

                <p className="mt-2 text-sm text-gray-500">
                  or paste an image with ⌘V
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 rounded-lg border px-4 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {file ? "Choose a different image" : "Choose image"}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file && (
                  <p className="mt-3 text-sm text-gray-500">
                    {file.name || "Pasted image"}
                  </p>
                )}
              </div>
            </div>
          )}

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Upload preview"
              className="max-h-96 w-full rounded-lg border object-contain"
            />
          )}

          {generating && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-3 rounded-xl border p-6 text-center"
            >
              <span
                aria-hidden="true"
                className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/25 border-t-white"
              />
              <p className="font-medium">
                {phase === "uploading"
                  ? "Uploading your image..."
                  : "Generating captions..."}
              </p>
              <p className="text-sm text-gray-500">
                Free AI generation can occasionally take a little longer.
              </p>
            </div>
          )}

          {message && (
            <InlineFormError title="Unable to create battle" message={message} />
          )}

          {file && !generating && message && (
            <button
              type="button"
              onClick={() => void generateForFile(file)}
              className="w-full rounded-lg border px-4 py-3 font-medium transition-colors hover:bg-white/10"
            >
              Retry generation
            </button>
          )}
        </div>
      )}

      {result && (
        <section className="space-y-6">
          <h2 className="text-center text-2xl font-bold">
            Your Caption Battle
          </h2>

          <img
            src={result.imageUrl}
            alt="Caption battle"
            className="max-h-96 w-full rounded-lg border object-contain"
          />

          <div className="grid gap-4 md:grid-cols-2">
            {result.generations.map((generation, index) => (
              <article
                key={generation.id}
                className="rounded-lg border p-5"
              >
                <p className="mb-2 text-sm font-medium text-gray-500">
                  Caption {index === 0 ? "A" : "B"}
                </p>
                <p className="text-lg">{generation.content}</p>
              </article>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500">
            Saved successfully. This matchup is ready for community voting.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/media"
              className="rounded-lg border px-5 py-2 font-medium"
            >
              View Media
            </Link>

            <button
              type="button"
              onClick={handleCreateAnother}
              className="rounded-lg border px-5 py-2 font-medium"
            >
              Create another
            </button>

            <Link
              href="/dashboard"
              className="rounded-lg border px-5 py-2 font-medium"
            >
              Dashboard
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

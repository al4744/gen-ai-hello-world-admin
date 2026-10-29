
import Link from "next/link";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import {
  createProvider,
  updateProvider,
  deleteProvider,
} from "./provider-actions";
import {
  createModel,
  updateModel,
  deleteModel,
} from "./model-actions";

export const instant = false;

const PAGE_SIZE = 20;

const inputClass =
  "mt-2 w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-gray-600 focus:border-indigo-400";

const cardClass =
  "rounded-2xl border border-white/15 bg-white/[0.025] p-6 md:p-8";

const buttonClass =
  "cursor-pointer rounded-xl bg-indigo-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-400";

const deleteClass =
  "cursor-pointer rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-3 font-semibold text-red-300 hover:bg-red-500/20";

type ProviderValues = {
  slug?: string;
  name?: string;
  api_base_url?: string | null;
  description?: string;
  is_active?: boolean;
};

type ModelValues = {
  provider_id?: string;
  model_id?: string;
  display_name?: string;
  description?: string;
  is_active?: boolean;
};

type ProviderOption = {
  id: string;
  name: string;
};

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

function safePage(value?: string) {
  const n = Number(value ?? "1");
  return Number.isSafeInteger(n) && n > 0
    ? Math.min(n, 10000)
    : 1;
}

function pageHref(providersPage: number, modelsPage: number) {
  return `/llm-catalog?providersPage=${providersPage}&modelsPage=${modelsPage}`;
}

function Field({
  id,
  label,
  name,
  value,
  maxLength,
  required = false,
  rows,
  placeholder,
  type = "text",
}: {
  id: string;
  label: string;
  name: string;
  value?: string | null;
  maxLength?: number;
  required?: boolean;
  rows?: number;
  placeholder?: string;
  type?: "text" | "url";
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {rows ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          required={required}
          maxLength={maxLength}
          defaultValue={value ?? ""}
          placeholder={placeholder}
          className={inputClass}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          maxLength={maxLength}
          defaultValue={value ?? ""}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
    </div>
  );
}

function ActiveCheckbox({
  checked = true,
}: {
  checked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        name="isActive"
        defaultChecked={checked}
        className="h-5 w-5 accent-indigo-400"
      />
      <span className="text-sm font-medium">Active</span>
    </label>
  );
}

function ProviderFields({
  prefix,
  values,
}: {
  prefix: string;
  values?: ProviderValues;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          id={`${prefix}-slug`}
          label="Provider Slug"
          name="slug"
          value={values?.slug}
          required
          maxLength={80}
          placeholder="e.g. openrouter"
        />
        <Field
          id={`${prefix}-name`}
          label="Provider Name"
          name="name"
          value={values?.name}
          required
          maxLength={120}
          placeholder="e.g. OpenRouter"
        />
      </div>
      <Field
        id={`${prefix}-url`}
        label="API Base URL (optional)"
        name="apiBaseUrl"
        value={values?.api_base_url}
        maxLength={500}
        type="url"
        placeholder="https://example.com/api/v1"
      />
      <Field
        id={`${prefix}-description`}
        label="Description (optional)"
        name="description"
        value={values?.description}
        maxLength={2000}
        rows={3}
        placeholder="Describe the provider..."
      />
      <ActiveCheckbox checked={values?.is_active ?? true} />
    </div>
  );
}

function ModelFields({
  prefix,
  providers,
  values,
}: {
  prefix: string;
  providers: ProviderOption[];
  values?: ModelValues;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor={`${prefix}-provider`}
          className="block text-sm font-medium"
        >
          LLM Provider
        </label>
        <select
          id={`${prefix}-provider`}
          name="providerId"
          required
          defaultValue={values?.provider_id ?? ""}
          className={inputClass}
        >
          <option value="" className="bg-zinc-900">
            Select a provider
          </option>
          {providers.map((provider) => (
            <option
              key={provider.id}
              value={provider.id}
              className="bg-zinc-900"
            >
              {provider.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Field
          id={`${prefix}-model-id`}
          label="Model Identifier"
          name="modelId"
          value={values?.model_id}
          required
          maxLength={200}
          placeholder="e.g. anthropic/claude-sonnet-4"
        />
        <Field
          id={`${prefix}-display-name`}
          label="Display Name"
          name="displayName"
          value={values?.display_name}
          required
          maxLength={150}
          placeholder="e.g. Claude Sonnet"
        />
      </div>
      <Field
        id={`${prefix}-description`}
        label="Description (optional)"
        name="description"
        value={values?.description}
        maxLength={2000}
        rows={3}
        placeholder="Describe this model..."
      />
      <ActiveCheckbox checked={values?.is_active ?? true} />
    </div>
  );
}

function DeleteForm({
  id,
  name,
  action,
  kind,
}: {
  id: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
  kind: string;
}) {
  return (
    <div className="mt-8 border-t border-red-500/20 pt-6">
      <h4 className="font-semibold text-red-300">
        Delete {kind}
      </h4>
      <p className="mt-2 text-sm text-gray-400">
        This action is permanent. Type the exact confirmation:
      </p>
      <p className="mt-2 break-all font-mono text-sm text-red-300">
        DELETE {name}
      </p>
      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="id" value={id} />
        <input
          name="confirmation"
          type="text"
          required
          autoComplete="off"
          aria-label={`Confirm deletion of ${name}`}
          className={inputClass}
        />
        <div>
          <button type="submit" className={deleteClass}>
            Permanently Delete
          </button>
        </div>
      </form>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  previousHref,
  nextHref,
}: {
  page: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link
          href={previousHref}
          className="rounded-xl border border-white/20 px-5 py-3 text-sm hover:bg-white/10"
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-gray-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={nextHref}
          className="rounded-xl border border-white/20 px-5 py-3 text-sm hover:bg-white/10"
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

export default async function LLMCatalogPage({
  searchParams,
}: PageProps) {
  await connection();

  const { supabase } = await requireSuperadmin();
  const params = await searchParams;

  const providersPage = safePage(params.providersPage);
  const modelsPage = safePage(params.modelsPage);

  const providerOffset = (providersPage - 1) * PAGE_SIZE;
  const modelOffset = (modelsPage - 1) * PAGE_SIZE;

  const [providerResult, modelResult, optionsResult] =
    await Promise.all([
      supabase
        .from("llm_providers")
        .select(
          "id, slug, name, api_base_url, description, is_active, created_at, updated_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(providerOffset, providerOffset + PAGE_SIZE - 1),

      supabase
        .from("llm_models")
        .select(
          "id, provider_id, model_id, display_name, description, is_active, created_at, updated_at",
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(modelOffset, modelOffset + PAGE_SIZE - 1),

      supabase
        .from("llm_providers")
        .select("id, name")
        .order("name", { ascending: true })
        .limit(1000),
    ]);

  if (
    providerResult.error ||
    modelResult.error ||
    optionsResult.error
  ) {
    console.error("LLM catalog query failed:", {
      providers: providerResult.error,
      models: modelResult.error,
      options: optionsResult.error,
    });
    throw new Error("Unable to load LLM catalog.");
  }

  const providers = providerResult.data ?? [];
  const models = modelResult.data ?? [];
  const providerOptions = optionsResult.data ?? [];

  const providerNames = new Map(
    providerOptions.map((provider) => [
      provider.id,
      provider.name,
    ])
  );

  const providerTotal = providerResult.count ?? 0;
  const modelTotal = modelResult.count ?? 0;

  const providerPages = Math.max(
    1,
    Math.ceil(providerTotal / PAGE_SIZE)
  );
  const modelPages = Math.max(
    1,
    Math.ceil(modelTotal / PAGE_SIZE)
  );

  const messages: Record<string, string> = {
    providerCreated: "LLM provider created successfully.",
    providerUpdated: "LLM provider updated successfully.",
    providerDeleted: "LLM provider deleted successfully.",
    modelCreated: "LLM model created successfully.",
    modelUpdated: "LLM model updated successfully.",
    modelDeleted: "LLM model deleted successfully.",
  };

  const notice = Object.entries(messages).find(
    ([key]) => params[key] === "1"
  );

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header>
        <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
          LLM Catalog
        </h1>
        <p className="mt-4 max-w-2xl text-gray-400">
          Manage AI providers and their models. Catalog
          entries are configuration metadata and do not
          automatically change the live generation pipeline.
        </p>
      </header>

      {notice && (
        <div
          role="status"
          className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-300"
        >
          {notice[1]}
        </div>
      )}

      {/* PROVIDERS */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">
          LLM Providers
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Manage provider identities and API endpoint metadata.
        </p>

        <div className={`${cardClass} mt-6`}>
          <h3 className="text-xl font-semibold">
            Create a provider
          </h3>
          <form
            action={createProvider}
            className="mt-8 space-y-6"
          >
            <ProviderFields prefix="new-provider" />
            <button type="submit" className={buttonClass}>
              Create Provider
            </button>
          </form>
        </div>

        <div className="mt-10">
          <h3 className="text-xl font-semibold">
            Provider directory
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            {providerTotal} provider
            {providerTotal === 1 ? "" : "s"} in the database.
          </p>

          {providers.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-10 text-center text-gray-400">
              No providers found on this page.
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {providers.map((provider) => (
                <article
                  key={provider.id}
                  className={cardClass}
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-semibold">
                        {provider.name}
                      </h4>
                      <p className="mt-2 font-mono text-xs text-gray-500">
                        {provider.slug}
                      </p>
                    </div>
                    <span className="text-sm text-gray-400">
                      {provider.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  {provider.api_base_url && (
                    <p className="mt-4 break-all text-sm text-indigo-300">
                      {provider.api_base_url}
                    </p>
                  )}

                  {provider.description && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-400">
                      {provider.description}
                    </p>
                  )}

                  <details className="mt-6 border-t border-white/10 pt-5">
                    <summary className="cursor-pointer text-sm font-medium text-indigo-300">
                      Edit or delete provider
                    </summary>

                    <form
                      action={updateProvider}
                      className="mt-8 space-y-6"
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={provider.id}
                      />
                      <ProviderFields
                        prefix={`provider-${provider.id}`}
                        values={provider}
                      />
                      <button
                        type="submit"
                        className={buttonClass}
                      >
                        Save Provider Changes
                      </button>
                    </form>

                    <DeleteForm
                      id={provider.id}
                      name={provider.name}
                      action={deleteProvider}
                      kind="provider"
                    />
                  </details>
                </article>
              ))}
            </div>
          )}

          <Pagination
            page={providersPage}
            totalPages={providerPages}
            previousHref={pageHref(
              providersPage - 1,
              modelsPage
            )}
            nextHref={pageHref(
              providersPage + 1,
              modelsPage
            )}
          />
        </div>
      </section>

      {/* MODELS */}
      <section className="mt-16 border-t border-white/10 pt-12">
        <h2 className="text-2xl font-semibold">
          LLM Models
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Register and manage models belonging to providers.
        </p>

        <div className={`${cardClass} mt-6`}>
          <h3 className="text-xl font-semibold">
            Create a model
          </h3>

          {providerOptions.length === 0 && (
            <p className="mt-4 text-sm text-amber-300">
              Create an LLM provider before adding models.
            </p>
          )}

          <form
            action={createModel}
            className="mt-8 space-y-6"
          >
            <ModelFields
              prefix="new-model"
              providers={providerOptions}
            />
            <button
              type="submit"
              disabled={providerOptions.length === 0}
              className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Create Model
            </button>
          </form>
        </div>

        <div className="mt-10">
          <h3 className="text-xl font-semibold">
            Model directory
          </h3>
          <p className="mt-2 text-sm text-gray-400">
            {modelTotal} model
            {modelTotal === 1 ? "" : "s"} in the database.
          </p>

          {models.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-10 text-center text-gray-400">
              No models found on this page.
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {models.map((model) => (
                <article
                  key={model.id}
                  className={cardClass}
                >
                  <div className="flex flex-wrap justify-between gap-4">
                    <div>
                      <h4 className="text-lg font-semibold">
                        {model.display_name}
                      </h4>
                      <p className="mt-2 break-all font-mono text-xs text-gray-500">
                        {model.model_id}
                      </p>
                      <p className="mt-2 text-sm text-indigo-300">
                        Provider:{" "}
                        {providerNames.get(model.provider_id) ??
                          "Unknown provider"}
                      </p>
                    </div>
                    <span className="text-sm text-gray-400">
                      {model.is_active
                        ? "Active"
                        : "Inactive"}
                    </span>
                  </div>

                  {model.description && (
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm text-gray-400">
                      {model.description}
                    </p>
                  )}

                  <details className="mt-6 border-t border-white/10 pt-5">
                    <summary className="cursor-pointer text-sm font-medium text-indigo-300">
                      Edit or delete model
                    </summary>

                    <form
                      action={updateModel}
                      className="mt-8 space-y-6"
                    >
                      <input
                        type="hidden"
                        name="id"
                        value={model.id}
                      />
                      <ModelFields
                        prefix={`model-${model.id}`}
                        providers={providerOptions}
                        values={model}
                      />
                      <button
                        type="submit"
                        className={buttonClass}
                      >
                        Save Model Changes
                      </button>
                    </form>

                    <DeleteForm
                      id={model.id}
                      name={model.display_name}
                      action={deleteModel}
                      kind="model"
                    />
                  </details>
                </article>
              ))}
            </div>
          )}

          <Pagination
            page={modelsPage}
            totalPages={modelPages}
            previousHref={pageHref(
              providersPage,
              modelsPage - 1
            )}
            nextHref={pageHref(
              providersPage,
              modelsPage + 1
            )}
          />
        </div>
      </section>
    </main>
  );
}

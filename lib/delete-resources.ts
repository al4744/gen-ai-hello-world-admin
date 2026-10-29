import { deleteTerm } from "@/app/(admin)/terms/actions";
import { deleteGenerationExample } from "@/app/(admin)/ai-generation-examples/actions";
import { deleteProvider } from "@/app/(admin)/llm-catalog/provider-actions";
import { deleteModel } from "@/app/(admin)/llm-catalog/model-actions";
import { deleteSignupDomain } from "@/app/(admin)/signup-access/domain-actions";
import { deleteWhitelistedEmail } from "@/app/(admin)/signup-access/email-actions";
import { deleteBattle } from "@/app/(admin)/media/[id]/edit/actions";

type DeleteResource = {
  label: string;
  table: string;
  selection: string;
  listPath: string;
  idField: string;
  action: (formData: FormData) => Promise<void>;
  warning?: string;
};

const resources = {
  term: {
    label: "Term",
    table: "terms",
    selection: "id, name:term",
    listPath: "/terms",
    idField: "id",
    action: deleteTerm,
  },
  example: {
    label: "AI generation example",
    table: "ai_generation_examples",
    selection: "id, name:title",
    listPath: "/ai-generation-examples",
    idField: "id",
    action: deleteGenerationExample,
  },
  provider: {
    label: "LLM provider",
    table: "llm_providers",
    selection: "id, name",
    listPath: "/llm-catalog",
    idField: "id",
    action: deleteProvider,
    warning: "Providers with models still referencing them cannot be deleted. Delete or reassign those models first.",
  },
  model: {
    label: "LLM model",
    table: "llm_models",
    selection: "id, name:display_name",
    listPath: "/llm-catalog",
    idField: "id",
    action: deleteModel,
  },
  domain: {
    label: "Allowed signup domain",
    table: "allowed_signup_domains",
    selection: "id, name:domain",
    listPath: "/signup-access",
    idField: "id",
    action: deleteSignupDomain,
  },
  email: {
    label: "Whitelisted email",
    table: "whitelisted_emails",
    selection: "id, name:email",
    listPath: "/signup-access",
    idField: "id",
    action: deleteWhitelistedEmail,
  },
  battle: {
    label: "Media battle",
    table: "generation_sets",
    selection: "id, name:id",
    listPath: "/media",
    idField: "battleId",
    action: deleteBattle,
    warning: "This also deletes the battle’s captions, votes, and generation provenance. Its stored image is removed only when no other battle references it.",
  },
} as const satisfies Record<string, DeleteResource>;

export type DeleteState = { error: string | null };

export function getDeleteResource(resource: string) {
  return Object.hasOwn(resources, resource) ? resources[resource as keyof typeof resources] : null;
}

export function isValidDeleteId(resource: string, id: string) {
  if (resource === "battle") {
    return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

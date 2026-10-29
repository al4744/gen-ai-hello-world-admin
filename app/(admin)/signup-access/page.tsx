
import Link from "next/link";
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";
import {
  createSignupDomain,
  updateSignupDomain,
  deleteSignupDomain,
} from "./domain-actions";
import {
  createWhitelistedEmail,
  updateWhitelistedEmail,
  deleteWhitelistedEmail,
} from "./email-actions";

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

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

type AccessItem = {
  id: string;
  value: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

type ServerAction = (formData: FormData) => Promise<void>;

type AccessSectionProps = {
  kind: "domain" | "email";
  title: string;
  description: string;
  items: AccessItem[];
  total: number;
  page: number;
  totalPages: number;
  previousHref: string;
  nextHref: string;
  createAction: ServerAction;
  updateAction: ServerAction;
  deleteAction: ServerAction;
};

function safePage(value?: string) {
  const n = Number(value ?? "1");

  return Number.isSafeInteger(n) && n > 0
    ? Math.min(n, 10000)
    : 1;
}

function pageHref(domainsPage: number, emailsPage: number) {
  return `/signup-access?domainsPage=${domainsPage}&emailsPage=${emailsPage}`;
}

function AccessFields({
  kind,
  prefix,
  item,
}: {
  kind: "domain" | "email";
  prefix: string;
  item?: AccessItem;
}) {
  const isDomain = kind === "domain";
  const label = isDomain ? "Allowed Domain" : "Email Address";

  return (
    <div className="space-y-6">
      <div>
        <label
          htmlFor={`${prefix}-value`}
          className="block text-sm font-medium"
        >
          {label}
        </label>

        <input
          id={`${prefix}-value`}
          name={isDomain ? "domain" : "email"}
          type={isDomain ? "text" : "email"}
          required
          maxLength={isDomain ? 253 : 254}
          defaultValue={item?.value ?? ""}
          placeholder={
            isDomain
              ? "e.g. columbia.edu"
              : "e.g. student@columbia.edu"
          }
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          className={inputClass}
        />

        <p className="mt-2 text-xs text-gray-500">
          {isDomain
            ? "Enter a domain without @ or https://."
            : "Enter a complete email address."}
        </p>
      </div>

      <div>
        <label
          htmlFor={`${prefix}-description`}
          className="block text-sm font-medium"
        >
          Description (optional)
        </label>

        <textarea
          id={`${prefix}-description`}
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={item?.description ?? ""}
          placeholder="Administrative notes..."
          className={inputClass}
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={item?.is_active ?? true}
          className="h-5 w-5 accent-indigo-400"
        />
        <span className="text-sm font-medium">
          Active {kind}
        </span>
      </label>
    </div>
  );
}

function DeleteForm({
  item,
  kind,
  action,
}: {
  item: AccessItem;
  kind: "domain" | "email";
  action: ServerAction;
}) {
  return (
    <div className="mt-10 border-t border-red-500/20 pt-6">
      <h4 className="font-semibold text-red-300">
        Delete {kind}
      </h4>

      <p className="mt-2 text-sm text-gray-400">
        This permanently removes the record. Enter the
        exact confirmation below.
      </p>

      <p className="mt-3 break-all font-mono text-sm text-red-300">
        DELETE {item.value}
      </p>

      <form action={action} className="mt-5 space-y-4">
        <input type="hidden" name="id" value={item.id} />

        <label
          htmlFor={`delete-${kind}-${item.id}`}
          className="block text-sm font-medium"
        >
          Confirmation
        </label>

        <input
          id={`delete-${kind}-${item.id}`}
          name="confirmation"
          type="text"
          required
          autoComplete="off"
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

function AccessSection({
  kind,
  title,
  description,
  items,
  total,
  page,
  totalPages,
  previousHref,
  nextHref,
  createAction,
  updateAction,
  deleteAction,
}: AccessSectionProps) {
  const plural = kind === "domain" ? "domains" : "emails";

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-semibold">{title}</h2>

      <p className="mt-2 text-sm text-gray-400">
        {description}
      </p>

      {/* CREATE */}
      <div className={`${cardClass} mt-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">
              Create {kind === "domain" ? "a domain" : "an email entry"}
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              Add a new {kind} to the database.
            </p>
          </div>

          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
            CREATE
          </span>
        </div>

        <form action={createAction} className="mt-8 space-y-6">
          <AccessFields kind={kind} prefix={`new-${kind}`} />

          <button type="submit" className={buttonClass}>
            Create {kind === "domain" ? "Domain" : "Email"}
          </button>
        </form>
      </div>

      {/* READ */}
      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">
              {kind === "domain"
                ? "Domain directory"
                : "Email directory"}
            </h3>

            <p className="mt-2 text-sm text-gray-400">
              {total} {total === 1 ? kind : plural} in the database.
            </p>
          </div>

          <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-10 text-center text-gray-400">
            No {plural} found on this page.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {items.map((item) => (
              <article key={item.id} className={cardClass}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h4 className="break-all text-lg font-semibold">
                      {item.value}
                    </h4>

                    <p className="mt-2 font-mono text-xs text-gray-500">
                      {item.id}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      item.is_active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-gray-500/30 bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {item.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {item.description && (
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm text-gray-400">
                    {item.description}
                  </p>
                )}

                <p className="mt-5 text-xs text-gray-500">
                  Created:{" "}
                  {new Date(item.created_at).toLocaleDateString(
                    "en-US"
                  )}
                </p>

                {/* UPDATE AND DELETE */}
                <details className="mt-6 border-t border-white/10 pt-5">
                  <summary className="cursor-pointer text-sm font-medium text-indigo-300">
                    Edit or delete {kind}
                  </summary>

                  <form
                    action={updateAction}
                    className="mt-8 space-y-6"
                  >
                    <input
                      type="hidden"
                      name="id"
                      value={item.id}
                    />

                    <AccessFields
                      kind={kind}
                      prefix={`edit-${kind}-${item.id}`}
                      item={item}
                    />

                    <button
                      type="submit"
                      className={buttonClass}
                    >
                      Save Changes
                    </button>
                  </form>

                  <DeleteForm
                    item={item}
                    kind={kind}
                    action={deleteAction}
                  />
                </details>
              </article>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        <div className="mt-8 flex items-center justify-between gap-4">
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
      </div>
    </section>
  );
}

export default async function SignupAccessPage({
  searchParams,
}: PageProps) {
  await connection();

  const { supabase } = await requireSuperadmin();
  const params = await searchParams;

  const domainsPage = safePage(params.domainsPage);
  const emailsPage = safePage(params.emailsPage);

  const domainOffset = (domainsPage - 1) * PAGE_SIZE;
  const emailOffset = (emailsPage - 1) * PAGE_SIZE;

  const [domainResult, emailResult] = await Promise.all([
    supabase
      .from("allowed_signup_domains")
      .select(
        "id, domain, description, is_active, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(domainOffset, domainOffset + PAGE_SIZE - 1),

    supabase
      .from("whitelisted_emails")
      .select(
        "id, email, description, is_active, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(emailOffset, emailOffset + PAGE_SIZE - 1),
  ]);

  if (domainResult.error || emailResult.error) {
    console.error("Signup access query failed:", {
      domains: domainResult.error,
      emails: emailResult.error,
    });

    throw new Error("Unable to load signup access settings.");
  }

  const domains = (domainResult.data ?? []).map((item) => ({
    id: item.id,
    value: item.domain,
    description: item.description,
    is_active: item.is_active,
    created_at: item.created_at,
  }));

  const emails = (emailResult.data ?? []).map((item) => ({
    id: item.id,
    value: item.email,
    description: item.description,
    is_active: item.is_active,
    created_at: item.created_at,
  }));

  const domainTotal = domainResult.count ?? 0;
  const emailTotal = emailResult.count ?? 0;

  const domainPages = Math.max(
    1,
    Math.ceil(domainTotal / PAGE_SIZE)
  );

  const emailPages = Math.max(
    1,
    Math.ceil(emailTotal / PAGE_SIZE)
  );

  const messages: Record<string, string> = {
    domainCreated: "Signup domain created successfully.",
    domainUpdated: "Signup domain updated successfully.",
    domainDeleted: "Signup domain deleted successfully.",
    emailCreated: "Whitelisted email created successfully.",
    emailUpdated: "Whitelisted email updated successfully.",
    emailDeleted: "Whitelisted email deleted successfully.",
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
          Signup Access
        </h1>

        <p className="mt-4 max-w-2xl text-gray-400">
          Manage approved signup domains and individually
          whitelisted email addresses. Create, inspect,
          update, and remove access configuration records.
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

      <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
        These records are administrative configuration.
        Signup restrictions are not enforced until integrated
        into the main application's authentication flow.
      </div>

      <AccessSection
        kind="domain"
        title="Allowed Signup Domains"
        description="Manage approved email domains for registration."
        items={domains}
        total={domainTotal}
        page={domainsPage}
        totalPages={domainPages}
        previousHref={pageHref(domainsPage - 1, emailsPage)}
        nextHref={pageHref(domainsPage + 1, emailsPage)}
        createAction={createSignupDomain}
        updateAction={updateSignupDomain}
        deleteAction={deleteSignupDomain}
      />

      <div className="mt-16 border-t border-white/10 pt-2">
        <AccessSection
          kind="email"
          title="Whitelisted Emails"
          description="Manage individually approved email addresses."
          items={emails}
          total={emailTotal}
          page={emailsPage}
          totalPages={emailPages}
          previousHref={pageHref(domainsPage, emailsPage - 1)}
          nextHref={pageHref(domainsPage, emailsPage + 1)}
          createAction={createWhitelistedEmail}
          updateAction={updateWhitelistedEmail}
          deleteAction={deleteWhitelistedEmail}
        />
      </div>
    </main>
  );
}

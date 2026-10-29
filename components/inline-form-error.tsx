export default function InlineFormError({
  message,
  title,
  id,
}: {
  message: string;
  title?: string;
  id?: string;
}) {
  return (
    <div id={id} role="alert" className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="mt-0.5 h-5 w-5 shrink-0">
        <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01" />
      </svg>
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <p className={title ? "mt-1 leading-6" : "leading-6"}>{message}</p>
      </div>
    </div>
  );
}

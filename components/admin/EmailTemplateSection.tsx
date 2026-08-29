const inputClass = "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

export function EmailTemplateSection({
  title,
  subject,
  template,
  tags,
  preview,
  updateAction,
  resetAction,
}: {
  title: string;
  subject: string;
  template: string;
  tags: readonly string[];
  preview: string;
  updateAction: (formData: FormData) => void;
  resetAction: (formData: FormData) => void;
}) {
  return (
    <div className="space-y-2 border-t border-neutral-200 pt-4 first:border-0 first:pt-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-neutral-500">
        Asunto (fijo, no editable): <span className="font-mono">{subject}</span>
      </p>
      <form action={updateAction} className="space-y-2">
        <textarea name="template" defaultValue={template} rows={10} className={`${inputClass} font-mono`} />
        <p className="text-xs text-neutral-500">
          Variables disponibles: {tags.map((t) => `{{${t}}}`).join(", ")}
        </p>
        <div className="flex gap-3">
          <button className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium">
            Guardar
          </button>
          <button type="submit" formAction={resetAction} className="text-sm text-neutral-500 hover:underline">
            Restaurar texto original
          </button>
        </div>
      </form>
      <details className="text-xs text-neutral-600">
        <summary className="cursor-pointer select-none">Ver cómo queda (con datos de ejemplo)</summary>
        <pre className="mt-2 whitespace-pre-wrap rounded-md border border-neutral-200 bg-neutral-50 p-3">
          {preview}
        </pre>
      </details>
    </div>
  );
}

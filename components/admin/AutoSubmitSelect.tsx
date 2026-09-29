"use client";

export function AutoSubmitSelect({
  name,
  defaultValue,
  options,
  className,
  emptyLabel = "Sin asignar",
}: {
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
  className?: string;
  emptyLabel?: string;
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      <option value="">{emptyLabel}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

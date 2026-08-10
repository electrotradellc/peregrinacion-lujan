"use client";

export function AutoSubmitCheckbox({
  name,
  defaultChecked,
}: {
  name: string;
  defaultChecked: boolean;
}) {
  return (
    <input
      type="checkbox"
      name={name}
      defaultChecked={defaultChecked}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    />
  );
}

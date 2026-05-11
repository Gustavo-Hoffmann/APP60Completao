import React from "react";
import { DateOfBirthInput } from "./DateOfBirthInput";

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
}) {
  return <DateOfBirthInput label={label} value={value} onChange={onChange} />;
}

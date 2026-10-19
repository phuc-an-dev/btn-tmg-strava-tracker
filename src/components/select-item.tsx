"use client";

import { Check } from "lucide-react";

export function SelectItem({ label, accessibleLabel = label, selected, onSelect, disabled = false, className = "" }: {
  label: string;
  accessibleLabel?: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return <button type="button" role="option" aria-label={accessibleLabel} aria-selected={selected} disabled={disabled} className={`select-item ${className}`} onClick={onSelect}>
    <span>{label}</span>
    <span className="select-item-indicator" aria-hidden="true">{selected && <Check size={14}/>}</span>
  </button>;
}

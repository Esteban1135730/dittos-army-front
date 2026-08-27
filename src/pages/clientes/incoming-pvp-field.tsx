import { useEffect, useRef, useState } from "react";
import { TextField } from "@mui/material";

type Props = {
  valueCop: number | null;
  disabled?: boolean;
  onSave: (cop: number | null) => Promise<void>;
};

export function incomingGroupPrecioCop(
  rows: Array<{ precio_cop?: number | null }>,
): number | null {
  for (const r of rows) {
    if (r.precio_cop != null && r.precio_cop > 0) return r.precio_cop;
  }
  return null;
}

export default function IncomingPvpField({ valueCop, disabled, onSave }: Props) {
  const [draft, setDraft] = useState(valueCop != null && valueCop > 0 ? String(valueCop) : "");
  const editingRef = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editingRef.current || busy) return;
    setDraft(valueCop != null && valueCop > 0 ? String(valueCop) : "");
  }, [valueCop, busy]);

  const handleBlur = async () => {
    editingRef.current = false;
    if (busy || disabled) return;
    const raw = draft.trim().replace(",", ".");
    const stored = valueCop != null && valueCop > 0 ? Math.round(valueCop) : null;
    if (raw === "" || raw === ".") {
      if (stored == null) {
        setDraft("");
        return;
      }
      setBusy(true);
      try {
        await onSave(null);
      } finally {
        setBusy(false);
      }
      return;
    }
    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num <= 0) {
      setDraft(stored != null ? String(stored) : "");
      return;
    }
    const next = Math.round(num);
    if (stored != null && next === stored) {
      setDraft(String(stored));
      return;
    }
    setBusy(true);
    try {
      await onSave(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <TextField
      size="small"
      label="PVP COP"
      value={draft}
      disabled={disabled || busy}
      onChange={(e) => {
        const value = e.target.value;
        if (value === "" || /^[0-9]*[.,]?[0-9]*$/.test(value)) {
          setDraft(value.replace(",", "."));
        }
      }}
      onFocus={() => {
        editingRef.current = true;
      }}
      onBlur={() => void handleBlur()}
      placeholder="Opcional"
      slotProps={{ htmlInput: { inputMode: "decimal" } }}
      sx={{ width: 120 }}
    />
  );
}

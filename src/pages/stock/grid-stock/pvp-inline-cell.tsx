import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { TextField } from "@mui/material";
import { useExchangeRates } from "../../../utils/tasa";
import type { StockListItem } from "../../../types/stock";

function rarezaFromListRow(item: StockListItem): string | null {
  let rz =
    item.rareza != null && String(item.rareza).trim() !== ""
      ? String(item.rareza).trim()
      : "";
  if (rz === "" && item.holofoil) rz = "holofoil";
  if (rz === "" && item.league_card) rz = "league card";
  return rz === "" ? null : rz;
}

function pvpStoredCop(
  item: StockListItem,
  convert: ReturnType<typeof useExchangeRates>["convert"]
): number {
  if (!item.pvp || item.pvp <= 0) return 0;
  if (item.pvp_currency === "COP") return item.pvp;
  if (item.pvp_currency === "EUR") return convert.toCopFromEur(item.pvp) ?? 0;
  if (item.pvp_currency === "USD") return convert.toCopFromUsd(item.pvp) ?? 0;
  return 0;
}

type PvpInlineCellProps = {
  row: StockListItem;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onOutcome: (message: string, severity: "success" | "error") => void;
  onSaved: () => void | Promise<void>;
};

export function PvpInlineCell({
  row,
  busy,
  onBusyChange,
  onOutcome,
  onSaved,
}: PvpInlineCellProps) {
  const { convert } = useExchangeRates();
  const [draft, setDraft] = useState("");
  const editingRef = useRef(false);

  useEffect(() => {
    if (editingRef.current || busy) return;
    const cop = Math.round(pvpStoredCop(row, convert));
    setDraft(cop > 0 ? String(cop) : "");
  }, [row._id, row.pvp, row.pvp_currency, busy]);

  const handleBlur = async () => {
    if (busy) return;

    const normalized = draft.trim().replace(",", ".");
    const storedCop = Math.round(pvpStoredCop(row, convert));

    try {
      if (normalized === "" || normalized === ".") {
        setDraft(storedCop > 0 ? String(storedCop) : "");
        return;
      }

      const num = parseFloat(normalized);
      if (!Number.isFinite(num) || num <= 0) {
        setDraft(storedCop > 0 ? String(storedCop) : "");
        return;
      }

      const nextCop = Math.round(num);
      if (storedCop > 0 && nextCop === storedCop) {
        setDraft(String(storedCop));
        return;
      }

      onBusyChange(true);
      try {
        await axios.post("http://localhost:3000/pvp", {
          card_id: row.card_id,
          pvp: nextCop,
          currency: "COP",
          rareza: rarezaFromListRow(row),
        });
        onOutcome("PVP actualizado.", "success");
        await onSaved();
      } catch (err: unknown) {
        setDraft(storedCop > 0 ? String(storedCop) : "");
        const ax = err as {
          response?: { data?: { message?: string | string[] } };
        };
        const msg = ax.response?.data?.message;
        const text = Array.isArray(msg) ? msg[0] : msg;
        onOutcome(
          typeof text === "string" ? text : "Error al actualizar el PVP.",
          "error"
        );
      } finally {
        onBusyChange(false);
      }
    } finally {
      editingRef.current = false;
    }
  };

  return (
    <TextField
      size="small"
      label="COP"
      value={draft}
      disabled={busy}
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
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      slotProps={{ htmlInput: { inputMode: "decimal" } }}
      placeholder="Sin asignar"
      sx={{ minWidth: 120 }}
    />
  );
}

/** Parsea el monto de un abono COP (entero ≥ 1, no mayor que el saldo si hay saldo). */

export type ParseAbonoAmountResult =
  | { ok: true; amount: number }
  | { ok: false; message: string };

const MSG_ENTERO = "Ingresa un monto entero en COP mayor o igual a 1.";
const MSG_SALDO = "El abono no puede superar el saldo.";

export function parseAbonoAmountCop(
  raw: string,
  saldoCop: number,
): ParseAbonoAmountResult {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: MSG_ENTERO };
  }
  const amount = Number(trimmed);
  if (!Number.isInteger(amount) || amount < 1) {
    return { ok: false, message: MSG_ENTERO };
  }
  if (saldoCop > 0 && amount > saldoCop) {
    return { ok: false, message: MSG_SALDO };
  }
  return { ok: true, amount };
}

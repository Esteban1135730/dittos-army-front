import type { Ct0BoxItem, Ct0QuantityState } from './cardtrader-ct0-box';
import { ct0LotKey } from './cardtrader-ct0-box';
import { normalizeMatchLanguage } from './incoming-ct0-homolog';

export type Ct0UnregisteredSoloLine = {
  source: 'ct0';
  lineKey: string;
  name: string;
  language: string;
  qty: number;
  label: string;
  referencePrice: string;
  blueprintId?: number;
  expansion?: string;
  paidAt?: string | null;
  ct0State?: Ct0QuantityState;
};

/** Idiomas que no registras en el panel (inventario asiático en CT Zero). */
export function isCt0UnregisteredInventoryLanguage(raw: string | undefined): boolean {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return false;

  const norm = normalizeMatchLanguage(s);
  if (norm === 'ja' || norm === 'zh' || norm === 'ko') return true;

  return (
    s === 'jp' ||
    s === 'kr' ||
    s.startsWith('zh-') ||
    s.startsWith('zh_') ||
    s === 'chinese' ||
    s === 'japanese' ||
    s === 'korean'
  );
}

export type Ct0UnregisteredLine = Ct0UnregisteredSoloLine & {
  expansion: string;
  paidAt: string | null;
  ct0State: Ct0QuantityState;
};

export type Ct0UnregisteredLot = {
  lotKey: string;
  paidAt: string | null;
  paidAtLabel: string;
  totalUnits: number;
  lineCount: number;
  languages: string[];
  lines: Ct0UnregisteredLine[];
};

function formatPaidAtLabel(paidAt: string | null): string {
  if (!paidAt) return 'Sin fecha de pago';
  const d = new Date(paidAt);
  if (Number.isNaN(d.getTime())) return paidAt;
  return d.toLocaleDateString('es-CO', { dateStyle: 'long' });
}

export function enrichSoloCt0Line(
  line: Ct0UnregisteredSoloLine,
  item: Ct0BoxItem,
  state: Ct0QuantityState,
): Ct0UnregisteredLine {
  return {
    ...line,
    expansion: item.expansion ?? '',
    paidAt: item.paid_at ?? null,
    ct0State: state,
  };
}

export function buildCt0UnregisteredLots(lines: Ct0UnregisteredLine[]): Ct0UnregisteredLot[] {
  const asian = lines.filter(
    (line) => line.source === 'ct0' && isCt0UnregisteredInventoryLanguage(line.language),
  );
  if (asian.length === 0) return [];

  const byLot = new Map<string, Ct0UnregisteredLine[]>();
  for (const line of asian) {
    const key = ct0LotKey({ paid_at: line.paidAt, id: 0 } as Ct0BoxItem);
    const list = byLot.get(key) ?? [];
    list.push(line);
    byLot.set(key, list);
  }

  const lots: Ct0UnregisteredLot[] = [];
  for (const [lotKey, lotLines] of byLot) {
    lotLines.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const paidAt = lotLines[0]?.paidAt ?? null;
    const languages = [...new Set(lotLines.map((l) => l.language))].sort();
    lots.push({
      lotKey,
      paidAt,
      paidAtLabel: formatPaidAtLabel(paidAt),
      totalUnits: lotLines.reduce((s, l) => s + l.qty, 0),
      lineCount: lotLines.length,
      languages,
      lines: lotLines,
    });
  }

  lots.sort((a, b) => Date.parse(b.paidAt ?? '') - Date.parse(a.paidAt ?? ''));
  return lots;
}

export function splitSoloCardtraderByInventoryPolicy<
  T extends { source: 'ct0' | 'order'; language: string; paidAt?: string | null },
>(lines: T[]): {
  ct0UnregisteredLines: T[];
  soloCardtrader: T[];
} {
  const ct0UnregisteredLines: T[] = [];
  const soloCardtrader: T[] = [];

  for (const line of lines) {
    if (line.source === 'ct0' && isCt0UnregisteredInventoryLanguage(line.language)) {
      ct0UnregisteredLines.push(line);
    } else {
      soloCardtrader.push(line);
    }
  }

  return { ct0UnregisteredLines, soloCardtrader };
}

export function filterCt0UnregisteredLotsBySearch(
  lots: Ct0UnregisteredLot[],
  rawQuery: string,
): Ct0UnregisteredLot[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return lots;

  return lots
    .map((lot) => ({
      ...lot,
      lines: lot.lines.filter(
        (line) =>
          line.name.toLowerCase().includes(q) ||
          line.language.toLowerCase().includes(q) ||
          line.expansion.toLowerCase().includes(q) ||
          line.label.toLowerCase().includes(q),
      ),
    }))
    .filter((lot) => lot.lines.length > 0)
    .map((lot) => ({
      ...lot,
      totalUnits: lot.lines.reduce((s, l) => s + l.qty, 0),
      lineCount: lot.lines.length,
    }));
}

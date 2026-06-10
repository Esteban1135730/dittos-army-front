const CARDTRADER_ORIGIN = 'https://cardtrader.com';

export type CtExpansionLite = {
  id: number;
  name?: string;
  name_en?: string;
};

export function normalizeCtExpansions(data: unknown): CtExpansionLite[] {
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is CtExpansionLite =>
        !!x && typeof x === 'object' && typeof (x as CtExpansionLite).id === 'number',
    );
  }
  if (data && typeof data === 'object' && 'expansions' in data) {
    return normalizeCtExpansions((data as { expansions: unknown }).expansions);
  }
  return [];
}

export function resolveCtExpansionId(
  expansions: CtExpansionLite[],
  expansionName: string,
): number | null {
  const target = expansionName.trim().toLowerCase();
  if (!target) return null;

  const exact = expansions.find(
    (e) =>
      e.name?.trim().toLowerCase() === target ||
      e.name_en?.trim().toLowerCase() === target,
  );
  if (exact) return exact.id;

  const partial = expansions.find((e) => {
    const n = e.name?.trim().toLowerCase() ?? '';
    const en = e.name_en?.trim().toLowerCase() ?? '';
    return n.includes(target) || target.includes(n) || en.includes(target) || target.includes(en);
  });
  return partial?.id ?? null;
}

export function extractBlueprintImageUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;

  if (typeof o.image_url === 'string' && o.image_url.trim()) {
    return o.image_url.trim();
  }

  const image = o.image as Record<string, unknown> | undefined;
  if (!image || typeof image !== 'object') return null;

  const preview = image.preview as { url?: unknown } | undefined;
  if (typeof preview?.url === 'string' && preview.url.trim()) {
    return absolutizeCardtraderUrl(preview.url.trim());
  }

  if (typeof image.url === 'string' && image.url.trim()) {
    return absolutizeCardtraderUrl(image.url.trim());
  }

  return null;
}

export function buildBlueprintImageUrlMapFromExport(data: unknown): Map<number, string> {
  const map = new Map<number, string>();
  if (!Array.isArray(data)) return map;

  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const id = (row as { id?: unknown }).id;
    if (typeof id !== 'number') continue;
    const imageUrl = extractBlueprintImageUrl(row);
    if (imageUrl) map.set(id, imageUrl);
  }

  return map;
}

export function absolutizeCardtraderUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${CARDTRADER_ORIGIN}${url}`;
  return `${CARDTRADER_ORIGIN}/${url}`;
}

/** URL lista para `<img>` vía proxy Nest. `apiBase` = raíz del API (sin `/cardtrader`). */
export function blueprintImageProxySrc(
  imageUrl: string | null | undefined,
  apiBase: string,
): string | undefined {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return undefined;
  const base = apiBase.replace(/\/$/, '');
  return `${base}/cardtrader/images/proxy?url=${encodeURIComponent(trimmed)}`;
}

import { describe, expect, it } from 'vitest';
import {
  absolutizeCardtraderUrl,
  blueprintImageProxySrc,
  buildBlueprintImageUrlMapFromExport,
  extractBlueprintImageUrl,
  resolveCtExpansionId,
} from './cardtrader-blueprint-image';

describe('cardtrader-blueprint-image', () => {
  it('extrae image_url absoluta del export', () => {
    expect(
      extractBlueprintImageUrl({
        image_url: 'https://cardtrader.com/uploads/blueprints/image/1/preview_x.jpg',
      }),
    ).toBe('https://cardtrader.com/uploads/blueprints/image/1/preview_x.jpg');
  });

  it('absolutiza preview relativa de blueprint item', () => {
    expect(
      extractBlueprintImageUrl({
        image: {
          preview: { url: '/uploads/blueprints/image/317780/preview_fan.jpg' },
        },
      }),
    ).toBe(
      'https://cardtrader.com/uploads/blueprints/image/317780/preview_fan.jpg',
    );
  });

  it('indexa blueprints export por id', () => {
    const map = buildBlueprintImageUrlMapFromExport([
      { id: 10, image_url: 'https://cardtrader.com/a.jpg' },
      { id: 20, image_url: 'https://cardtrader.com/b.jpg' },
    ]);
    expect(map.get(10)).toBe('https://cardtrader.com/a.jpg');
    expect(map.size).toBe(2);
  });

  it('resuelve expansion id por nombre exacto', () => {
    const id = resolveCtExpansionId(
      [{ id: 4053, name: 'Prismatic Evolutions - Poké Ball Reverse Holo' }],
      'Prismatic Evolutions - Poké Ball Reverse Holo',
    );
    expect(id).toBe(4053);
  });

  it('proxy usa raíz del API', () => {
    expect(
      blueprintImageProxySrc(
        'https://cardtrader.com/x.jpg',
        'http://localhost:3000',
      ),
    ).toBe(
      'http://localhost:3000/cardtrader/images/proxy?url=https%3A%2F%2Fcardtrader.com%2Fx.jpg',
    );
  });

  it('absolutizeCardtraderUrl respeta URLs completas', () => {
    expect(absolutizeCardtraderUrl('https://cdn.cardtrader.com/x.png')).toBe(
      'https://cdn.cardtrader.com/x.png',
    );
  });
});

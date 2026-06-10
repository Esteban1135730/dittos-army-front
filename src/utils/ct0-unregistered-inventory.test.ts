import { describe, expect, it } from 'vitest';
import {
  buildCt0UnregisteredLots,
  isCt0UnregisteredInventoryLanguage,
  splitSoloCardtraderByInventoryPolicy,
} from './ct0-unregistered-inventory';

describe('ct0-unregistered-inventory', () => {
  it('detecta idiomas asiáticos sin registro', () => {
    expect(isCt0UnregisteredInventoryLanguage('jp')).toBe(true);
    expect(isCt0UnregisteredInventoryLanguage('zh-CN')).toBe(true);
    expect(isCt0UnregisteredInventoryLanguage('en')).toBe(false);
  });

  it('agrupa CT Zero JP/ZH por lote de pago', () => {
    const { ct0UnregisteredLines } = splitSoloCardtraderByInventoryPolicy([
      {
        source: 'ct0',
        lineKey: 'a',
        name: 'Eevee',
        language: 'ja',
        qty: 1,
        label: 'Listas CT Zero',
        referencePrice: '$1',
        expansion: 'Crimson Haze',
        paidAt: '2026-05-31T16:55:45.000Z',
        ct0State: 'ok',
      },
      {
        source: 'ct0',
        lineKey: 'b',
        name: 'Floragato',
        language: 'zh-CN',
        qty: 1,
        label: 'Listas CT Zero',
        referencePrice: '$1',
        expansion: 'Gem Pack Vol.1',
        paidAt: '2026-05-16T19:04:01.000Z',
        ct0State: 'ok',
      },
      {
        source: 'order',
        lineKey: 'c',
        name: 'Pikachu',
        language: 'en',
        qty: 1,
        label: 'sent',
        referencePrice: '€1',
      },
    ]);

    const lots = buildCt0UnregisteredLots(
      ct0UnregisteredLines.filter(
        (line): line is typeof line & { expansion: string; ct0State: 'ok' } =>
          line.source === 'ct0' && !!line.expansion && line.ct0State != null,
      ),
    );

    expect(lots).toHaveLength(2);
    expect(lots.find((l) => l.paidAt?.startsWith('2026-05-16'))?.lineCount).toBe(1);
    expect(lots.find((l) => l.paidAt?.startsWith('2026-05-31'))?.lineCount).toBe(1);
  });
});

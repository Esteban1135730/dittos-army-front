---
name: cardtrader-tcgdex
description: >-
  Convierte un recibo HTML guardado de CardTrader en JSON enriquecido con IDs
  de TCGdex (tcgdex_card_id) para importar en dittos-army-front (entradas).
  Usar cuando el usuario pida procesar pedidos CardTrader, parsear HTML,
  generar cardtrader_order_with_tcgdex.json o resolver IDs TCGdex.
---

# CardTrader → TCGdex → JSON para Dittos Army

## Objetivo

El entregable para la plataforma es **`cardtrader_order_with_tcgdex.json`**. El campo crítico por línea es **`tcgdex_card_id`** (ej. `"sv08.5-057"`).

Scripts en **`scripts/card-trader/`** del monorepo Dittos Army.

## Requisitos

- Python 3
- `pip install -r scripts/card-trader/requirements.txt`
- TCGdex local (`http://localhost:3080/v2`, puerto en `TCGDEX_PORT` / `dittos-army-back/.env`)
- **`dittos-army-back/data/set_name_homologs.json`**: regenerar con `python scripts/card-trader/build_set_homologs.py` (usa `cards-database/` del repo)
- **`scripts/card-trader/data/set_locale_map.json`**: mapa locale set ↔ EN

## Estructura

```
scripts/card-trader/
├── parse_cardtrader_receipt.py
├── build_set_homologs.py      # → dittos-army-back/data/set_name_homologs.json
├── tcgdex_lookup.py
├── tcgdex_locale.py
├── process_order.ps1
├── requirements.txt
├── data/set_locale_map.json
└── archive/                   # pedidos (HTML + JSON)
    └── DD-MM-YYYY/
        ├── *CardTrader.html
        ├── cardtrader_order_items.json
        └── cardtrader_order_with_tcgdex.json   ← importar en panel
```

**Nuevos pedidos**: crear `scripts/card-trader/archive/DD-MM-YYYY/`, guardar ahí el HTML.

## Flujo (desde `scripts/card-trader/`)

```
- [ ] Localizar el HTML del pedido
- [ ] Paso 1: parse_cardtrader_receipt.py
- [ ] Paso 2: tcgdex_lookup.py
- [ ] Validar: todas las filas tienen tcgdex_card_id
- [ ] Indicar ruta del JSON final al usuario
```

### Paso 0 — HTML correcto

| Archivo | UI | Usar |
|---------|-----|------|
| `Congratulations, your order has been successfully created! _ CardTrader.html` | Inglés | **Preferir** |
| `Enhorabuena, su pedido se ha realizado correctamente! _ CardTrader.html` | Español | Solo si no hay EN |

### Atajo Windows

```powershell
cd scripts/card-trader
.\process_order.ps1 -OrderDir "16-05-2026-jp"
```

### Manual

```powershell
cd scripts/card-trader
python parse_cardtrader_receipt.py "archive/CARPETA/*CardTrader.html" -o "archive/CARPETA/cardtrader_order_items.json" --csv "archive/CARPETA/cardtrader_order_items.csv"
python tcgdex_lookup.py "archive/CARPETA/cardtrader_order_items.json" -o "archive/CARPETA/cardtrader_order_with_tcgdex.json"
```

### Validación

```powershell
python -c "import json; p='archive/CARPETA/cardtrader_order_with_tcgdex.json'; r=json.load(open(p,encoding='utf-8')); ok=sum(1 for x in r if x.get('tcgdex_card_id')); print(f'{ok}/{len(r)} con tcgdex_card_id')"
```

## Integración con Dittos Army

- Importar el JSON en **dittos-army-front** → página de crear entrada (`incoming-create`).
- El backend usa `set_name_homologs.json` y `cardtrader_tcgdex_homolog.json` en `dittos-army-back/data/`.
- `cards-database/` en disco + servidor local (`npm start` en `cards-database/server`).
- Variables: `TCGDEX_PORT` (default 3080), `TCGDEX_API_BASE` (override completo).

## Qué decir al usuario al terminar

1. Ruta de `cardtrader_order_with_tcgdex.json`
2. Ratio de match (`44/44`, etc.)
3. Líneas sin `tcgdex_card_id` si las hay
4. Recordar importar ese JSON en el panel de entradas

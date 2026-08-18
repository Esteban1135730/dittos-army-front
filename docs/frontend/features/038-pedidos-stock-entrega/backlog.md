# Backlog — Pedidos de stock en clientes (panel)

## Meta del incremento

| Campo | Valor |
|-------|--------|
| Carpeta | `038-pedidos-stock-entrega` |
| Consecutivo | `038` |
| Estado del incremento | `EN_ESPECIFICACION` |

## HU-001 — Pedido y entrega en el panel

**Como** operador  
**quiero** crear pedidos de stock con entrega y ver historial en el cliente  
**para** gestionar reservado / pagado / entregado sin tienda fija.

#### Criterios de aceptación

- [ ] CA-1: Formulario cliente sin tienda.
- [ ] CA-2: Dialog nuevo pedido (tienda o envío + fecha) antes de reservar stock.
- [ ] CA-3: Historial en detalle con acciones pagar / entregar.
- [ ] CA-4: WhatsApp, PDF e imprimir usan entrega del pedido.
- [ ] CA-5: Incoming sin cambios de entrega.

#### Casos borde

- CB-1: Pedido `pagado` bloquea agregar cartas.
- CB-2: 409 si se intenta un segundo pedido abierto.

#### Tareas

| ID | Descripción | Estado |
|----|-------------|--------|
| T-01 | Tipos + `pedido-entrega-label` + tests | TODO |
| T-02 | Dialog nuevo/editar pedido | TODO |
| T-03 | Quitar tienda de cliente (form, lista, detalle, reservar) | TODO |
| T-04 | Reservar cartas contra `pedido_id` | TODO |
| T-05 | Historial + pagar/entregar en detalle | TODO |
| T-06 | WhatsApp / PDF / imprimir | TODO |

## Registro de estados de tareas

| ID | Estado | Historia | Última actualización (ISO) |
|----|--------|----------|----------------------------|
| T-01 | TODO | HU-001 | 2026-08-17 |
| T-02 | TODO | HU-001 | 2026-08-17 |
| T-03 | TODO | HU-001 | 2026-08-17 |
| T-04 | TODO | HU-001 | 2026-08-17 |
| T-05 | TODO | HU-001 | 2026-08-17 |
| T-06 | TODO | HU-001 | 2026-08-17 |

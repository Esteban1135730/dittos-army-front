# Spec funcional — Pedidos de stock en clientes (panel)

Contrato API: `docs/backend/features/038-pedidos-stock-entrega/spec-tecnico.md`  
Paquete: **solo `dittos-army-front`**. No `dittos-army-store`. Incoming fuera de alcance.

## Objetivo

En Clientes, el operador:

1. No asigna tienda al cliente.
2. Crea un **pedido de stock** con «¿Entrega en tienda?» + tienda **o** datos de envío/punto, y fecha tentativa.
3. Agrega cartas de stock a ese pedido.
4. Pasa el pedido a **pagado** (venta) y luego **entregado**.
5. Ve historial de pedidos en el detalle.

## Supuestos (alineados al back)

- Primero «Nuevo pedido», después cartas.
- Envío: ciudad, dirección o punto, notas.
- Un pedido abierto (`reservado` o `pagado`) por cliente.
- Incoming sigue como hoy en la misma página de reservar, sin entrega de este incremento.

## Pantallas

### Lista `/clientes`

- Quitar columna «tienda».
- Banner/chip de pedido abierto opcional: estado + preview de entrega (si `GET /pedido/client/:id` no es caro: un campo `open_pedido` en listado **no** se añade en este incremento; el detalle basta).

### Formulario cliente (crear/editar)

- Quitar campo tienda de entrega.
- Validar solo nombre + contacto.

### Detalle `/clientes/:id`

- Quitar «Tienda de entrega» de datos principales.
- Bloque **Historial de pedidos** (stock): cada pedido con chip de estado, entrega (nombre+dirección de tienda o ciudad/punto), fecha tentativa, líneas (nombre, precio), total.
- Acciones según estado:
  - `reservado`: ir a reservar cartas, **Marcar pagado** (confirma), cancelar pedido (confirma).
  - `pagado`: **Marcar entregado**.
  - `entregado`: solo lectura.
- «Finalizar venta» se relabel a **Marcar pagado** y llama `POST /pedido/:id/pagar` (o el legacy que delega).
- WhatsApp resumen / copiar texto / PDF / imprimir etiquetas: texto de entrega del **pedido abierto** (`reservado` o `pagado`); si no hay, no inventar tienda del cliente.
- Incoming: se mantiene el bloque actual, sin mezclarlo en el historial de pedidos de stock.

### Reservar cartas `/clientes/:id/reservar`

- Quitar chip/edición de tienda del cliente.
- Si no hay pedido `reservado`: Alert + botón **Nuevo pedido** (dialog):
  - Checkbox «Entrega en tienda».
  - Si sí: catálogo de tiendas (nombre + dirección); incluye Real Burgers.
  - Si no: ciudad, dirección o punto, notas.
  - Date picker / input date **Fecha tentativa de entrega** (requerida).
- Si hay pedido `reservado`: mostrar entrega y fecha; permitir **Editar entrega**; grid de stock como hoy, `POST /reserva` con `pedido_id`.
- Si el abierto está `pagado`: no permitir agregar cartas; mensaje «Marca entregado en el detalle para abrir otro pedido».
- Incoming: sin cambios de entrega.

### Imprimir pedidos

- Agrupar por pedido (no por `client.tienda_entrega`).
- Mostrar entrega y fecha tentativa del pedido.

## Errores en UI

- 409 pedido abierto / sin pedido: Alert con el `message` del API.
- 400 validación: bajo el dialog de nuevo pedido.
- Pagar/entregar: Snackbar éxito/error como finalizar venta hoy.

## Fuera de alcance

- Store pública.
- Flujo de reservas en camino.
- Bandeja global de todos los pedidos (solo por cliente).

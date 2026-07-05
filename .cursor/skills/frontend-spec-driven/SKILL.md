---
name: frontend-spec-driven
description: Drives numbered feature folders (NNN-slug) under docs/frontend/features; uses the agent structured-question UI and step-by-step flow when choices are real; asks first whether work targets dittos-army-front (panel), dittos-army-store (shop), or both—then human-validated specs before implementation. Use for frontend features, specs, or when the user invokes this workflow.
---

# Entrega frontend con spec y backlog (Dittos Army)

Hay **dos** aplicaciones React: **`dittos-army-front/`** (panel operativo, “**front**”) y **`dittos-army-store/`** (tienda pública, “**store**”). La documentación vive en **`docs/frontend/features/`**; cada `spec-tecnico.md` debe indicar **qué paquete(s)** se modifican.

## Selección en interfaz y flujo por pasos

- **Interfaz**: cuando haya **opciones reales** (p. ej. panel / tienda / ambos; sí / no; elegir tarea `IN_PROGRESS`), usar la **pregunta estructurada del agente** (formulario en el chat, como en Claude) si la herramienta está disponible; si no, lista **numerada** con una línea por opción.
- **Pasos**: sigue el orden de esta skill como **pasos numerados** (Paso 0, 1, 2…) e **indica el paso actual** para que el usuario oriente la sesión.
- **Sin opciones inventadas**: si no hay varias alternativas genuinas, **no** fabriques A/B/C artificiales; pregunta de forma **abierta** o pide **un dato concreto** (p. ej. el slug acordado). El contenido de **`spec-*.md`** sigue siendo acuerdo con el humano, no relleno de “opciones falsas”.

## Primer paso obligatorio: superficie (front vs store)

Antes de redactar specs, crear carpetas de feature, tocar código o asumir rutas/API:

1. **Pregunta primero** al usuario en qué superficie caen los cambios: **`dittos-army-front`** (panel), **`dittos-army-store`** (tienda), o **ambos**. Usa pregunta estructurada con opciones si está disponible; si no, opciones numeradas en texto. Si el mensaje del usuario ya nombra una superficie con claridad, puedes **confirmar en una sola pregunta** (“¿Seguimos solo en panel?”) en lugar de repetir las tres opciones.
2. **No continúes** con el resto del flujo de esta skill hasta tener esa respuesta **explícita**, salvo la excepción del apartado siguiente.

**Excepción (no repetir la pregunta):** si ya existe una carpeta `docs/frontend/features/NNN-slug/` con tarea **`IN_PROGRESS`** y el `spec-tecnico.md` **ya nombra** el paquete o paquetes afectados de forma inequívoca **y** el mensaje del usuario deja claro que sigue ese incremento, puedes asumir esa superficie y seguir en “Detectar trabajo en curso”. En cualquier otro caso (mensaje vago, nueva feature, duda), **pregunta primero**.

## Principios iterativos

- **Superficie antes que alcance técnico**: `front` / `store` / ambos acordados **antes** de profundizar en implementación.
- **Pregunta antes que suponer**: objetivo, actores, alcance, slug y dependencias de `dittos-army-back` deben estar **acordados o confirmados** con el usuario (pregunta abierta o selección en interfaz según el caso).
- **Validación humana de specs**: no escribir ni modificar código de producto en **`dittos-army-front/`** ni **`dittos-army-store/`** (ni tests de ese comportamiento) hasta que el usuario declare explícitamente que **`spec-funcional.md` y `spec-tecnico.md` están aprobados** para desarrollo.
- **Estados en `backlog.md`**: no cambiar estados sin instrucción explícita del usuario o confirmación de una propuesta tuya. Ofrece opciones en lugar de editar silenciosamente.

## Al invocar esta skill (orden estricto)

### 0. Superficie (front vs store)

- Si aplica la **excepción** de arriba (reanudación clara con `IN_PROGRESS` y paquete ya fijado en specs), pasa al paso 1.
- En **cualquier otro caso**: **pregunta primero** “¿Panel (`dittos-army-front`), tienda (`dittos-army-store`), o ambos?” y **espera** la elección del usuario antes del paso 1 o 2.

### 1. Detectar trabajo en curso

- Listar `docs/frontend/features/` y considerar solo carpetas `^\d{3}-[a-z0-9-]+$`.
- Abrir cada `backlog.md` y buscar **`IN_PROGRESS`** en las tablas de tareas.
- **Si hay exactamente una carpeta con alguna tarea `IN_PROGRESS`**: **candidata** a contexto activo. Lee ambas specs. Si falta aprobación o el foco no está claro, **pregunta** antes de implementar o de cambiar estados.
- **Si hay más de una carpeta con `IN_PROGRESS`**: detente; **pregunta** qué incremento debe quedar activo.
- **Si no hay `IN_PROGRESS`**: paso 2.

### 2. Nueva funcionalidad (sin tarea en curso)

1. Confirma que el **paso 0** ya dejó fijada la superficie (**front** / **store** / ambos); si no, vuelve al paso 0.
2. Lee `docs/frontend/architecture.md` y `docs/frontend/functionalidades.md`.
3. **Pregunta** lo imprescindible si falta contexto: negocio, actores, alcance, dependencias de `dittos-army-back`, **slug** de la carpeta. No crees carpeta hasta **slug y alcance mínimo** acordados.
4. **Siguiente consecutivo**: máximo `NNN` entre carpetas `NNN-*` + 1, siempre tres dígitos.
5. Crea `docs/frontend/features/<NNN>-<slug-kebab>/` con slug **acordado con el usuario**.
6. Copia desde `docs/frontend/plantilla/` los tres ficheros: `spec-funcional.md`, `spec-tecnico.md`, `backlog.md`.
7. Rellena borradores; en `spec-tecnico.md` refleja **de inicio** la superficie acordada (front / store / ambos). **Meta** en `EN_ESPECIFICACION` hasta validación humana. Tras aprobación de ambas specs, **pregunta** qué tarea pasa a `IN_PROGRESS`; como máximo una tarea en `IN_PROGRESS` a la vez.
8. Actualiza `docs/frontend/features/README.md` (tabla índice).

### Ficheros obligatorios por carpeta

| Fichero | Contenido |
|---------|-----------|
| `spec-funcional.md` | Spec funcional (negocio / usuario). |
| `spec-tecnico.md` | Spec técnico: **paquete(s)** (`dittos-army-front` / `dittos-army-store`), rutas, llamadas API o JSON, riesgos. |
| `backlog.md` | Historias, CA, casos borde, tareas con **Estado**, **Meta del incremento**, **Registro de estados de tareas** (ver [reference.md](reference.md)). |

**Fichero de estado:** el **`backlog.md`** es la fuente de verdad. Con autorización humana, actualiza de inmediato: (1) tabla de la historia, (2) **Registro de estados de tareas**, (3) **Estado del incremento** en Meta.

## Estados permitidos

Por tarea: `TODO` | `IN_PROGRESS` | `DONE` | `BLOCKED` (motivo breve si `BLOCKED`).

Por incremento (Meta): `EN_ESPECIFICACION` | `EN_DESARROLLO` | `EN_QA` | `CERRADO`.

## Coherencia global

Si el cambio altera arquitectura o mapa de pantallas, actualiza `docs/frontend/architecture.md` y/o `docs/frontend/functionalidades.md`.

## Implementación en código

Solo después de **validación humana explícita** de ambas specs y con estados del backlog acordados. Alineado con **module-authoring**.

## Plantilla

`docs/frontend/plantilla/` y [reference.md](reference.md).

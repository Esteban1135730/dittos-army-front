# Referencia: convenciones y plantillas — frontend (Dittos Army)

## Orden al aplicar la skill (resumen)

1. **Paso 0 — Preguntar primero** con **pregunta estructurada del agente** (si aplica) o texto: ¿**panel**, **tienda** o **ambos**? (Salvo reanudación clara con `IN_PROGRESS` y paquete ya fijado en `spec-tecnico.md` — ver skill principal.)
2. **Pasos siguientes** (detectar en curso, nueva feature, specs, implementación) como en `SKILL.md`. Sin inventar opciones; si falta dato, pregunta abierta.

## Nombre de carpeta (obligatorio)

Formato: **`NNN-slug-kebab`** (tres dígitos + slug kebab). El skill solo considera features con este patrón bajo `docs/frontend/features/`.

## Siguiente consecutivo

1. Listar directorios bajo `docs/frontend/features/` que casen con `^\d{3}-`.
2. Extraer el número máximo `NNN`.
3. Nuevo id = `String(max + 1).padStart(3, '0')`.

## `backlog.md` — bloque Meta del incremento (al inicio, tras el título)

```markdown
# Backlog — [Título legible]

## Meta del incremento

| Campo | Valor |
|-------|--------|
| Carpeta | `NNN-slug` |
| Consecutivo | `NNN` |
| Estado del incremento | `EN_ESPECIFICACION` |

Estados de incremento: `EN_ESPECIFICACION` | `EN_DESARROLLO` | `EN_QA` | `CERRADO`.
```

- **`EN_DESARROLLO`**: solo con validación explícita de ambas specs **y** autorización de al menos una tarea en `IN_PROGRESS` o avance acordado.
- **`EN_QA`**: desarrollo completado y pendiente validación.
- **`CERRADO`**: todas las tareas `DONE` o cierre acordado con `BLOCKED` documentado.

## `backlog.md` — Registro de estados de tareas (al final)

```markdown
## Registro de estados de tareas

| ID | Estado | Historia | Última actualización (ISO) |
|----|--------|----------|----------------------------|
| T-01 | TODO | HU-001 | YYYY-MM-DD |
```

## Historia de usuario (plantilla)

```markdown
### HU-001 — [Título corto]

**Como** [rol]  
**quiero** [acción]  
**para** [beneficio]

#### Criterios de aceptación

- [ ] CA-1: …

#### Casos borde

- CB-1: …

#### Tareas

| ID | Descripción | Estado |
|----|-------------|--------|
| T-01 | … | TODO |
```

## Superficie técnica — qué paquete tocar

| Paquete | Cuándo | Notas |
|---------|--------|--------|
| **`dittos-army-front`** | Stock, incoming, ventas, clientes, reservas, PVP, exportación a tienda | `axios` hacia `dittos-army-back`; hoy muchas URLs fijas a `localhost:3000` — en specs nuevas conviene planificar `VITE_API_BASE_URL`. |
| **`dittos-army-store`** | Catálogo público, carrito, WhatsApp, próximamente | `fetch` a `/inventory.json` y `/upcoming.json`; variables `VITE_*` si se externaliza el origen. |

Una misma feature puede listar tareas en **ambos** repositorios si el incremento lo requiere; el `spec-tecnico.md` debe separar claramente alcance por carpeta del monorepo.

## Validación humana y estados

- **Specs**: ninguna implementación en `dittos-army-front/` ni `dittos-army-store/` hasta aprobación explícita del usuario sobre **ambas** specs de la carpeta del incremento.
- **Backlog**: cada cambio de estado debe estar **ordenado o confirmado** por el humano.


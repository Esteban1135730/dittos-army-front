# Ditto Army Front

Aplicación React + Vite para operación de inventario/ventas.

## Configuración local

1. Copia `.env.example` a `.env`.
2. Ajusta `VITE_API_URL` al backend local.

Variables:

- `VITE_API_URL`: URL base de API (ej. `http://localhost:3000`).

## Ejecutar local

```bash
npm ci
npm run dev
```

## Build y pruebas

```bash
npm run build
npm run test
```

## Docker

Desde la raíz del workspace:

```bash
docker compose up --build
```

Frontend disponible en `http://localhost:8080`.

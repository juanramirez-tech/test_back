# Sistema de reservas de canchas

API Node.js + Express + TypeScript + MySQL (Sequelize). El núcleo de la prueba es impedir **doble reserva** bajo concurrencia.

- Invitado reserva **sin registrarse** (pago simulado al crear).
- Solo el **admin** inicia sesión (JWT) para confirmar o cancelar.
- Slots fijos de 30 o 60 minutos, mínimo 1 hora, varias canchas en la misma reserva.
- Fechas en **UTC**. Horario local de cancha: `America/Bogota`.
- Cancelación: si ya pagó o está confirmada, se retiene el **30%**.

Documentación interactiva (solo si `ENABLE_DOCS=true` o `NODE_ENV=development`): [http://localhost:3000/docs](http://localhost:3000/docs).

API publicada: `/login`, `/api/v1/courts`, `/api/v1/bookings`, `/api/v1/admin/courts`, `/api/v1/admin/bookings`. No hay registro público, CRUD de usuarios ni uploads.

## Levantar el proyecto

### Opción A — Docker Compose (recomendado)

```bash
cp .env.example .env
# Edita JWT_SECRET, AUTH, SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD

docker compose up --build
```

Si el puerto 3306 ya está ocupado por un MySQL local, usa solo la API en el host (`npm run dev`) o cambia el mapeo en `.env` (`DB_PORT`).

### Opción B — API local + MySQL

```bash
cp .env.example .env
npm install
npm run dev
```

Si MySQL va en Docker y la API en el host:

```bash
docker compose up -d mysql
```

Ajusta `.env`: `DB_HOST=127.0.0.1`, `DB_USER=app`, `DB_PASSWORD` igual que en compose.

## Variables mínimas

| Variable | Uso |
|---|---|
| `DB_*` | Conexión MySQL |
| `JWT_SECRET` | ≥ 32 caracteres |
| `AUTH` | ≥ 16 caracteres (header `auth` en `/login`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Admin de desarrollo |
| `CORS_ORIGINS` | `http://localhost:4200` para Angular |

| `ENABLE_DOCS` | Swagger en `/docs`. En production default off |
| `DB_SYNC_ALTER` | `true` solo en local al cambiar modelos; Compose lo deja en `false` |

`sequelize.sync()` crea tablas que no existen. `alter: true` modifica tablas vivas y puede borrar columnas: por eso no va en Docker ni en production.

El seed (solo development) **crea** el admin y las 3 canchas si no existen. Si ya están, no toca password, rol ni precios.

## Flujo de negocio

1. `POST /api/v1/bookings` — el invitado reserva. Por defecto `simulate_payment: true` → estado `paid` y slots ocupados.
2. Admin `POST /login` (header `auth` + body email/password).
3. `POST /api/v1/admin/bookings/:id/confirm` → `confirmed`.
4. Cancelar (invitado con `access_code` o admin): libera slots; 30% de penalidad si ya había pago.

`simulate_payment: false` deja un hold de 15 minutos (`pending_payment`). Un job cada 60s (y al consultar la reserva) expira holds y libera horarios.

## Concurrencia (cómo probarla)

El anti-solapamiento es:

1. Transacción + `SELECT ... FOR UPDATE` sobre las canchas.
2. Índice único MySQL `(court_id, starts_at)` en `reservation_slots`.
3. Si dos requests ganan la carrera, el segundo recibe `409` (`SLOT_TAKEN`).

Desde dos terminales a la vez (misma cancha y horario futuro):

```bash
curl -sS -X POST http://localhost:3000/api/v1/bookings \
  -H 'Content-Type: application/json' \
  -d '{
    "guest_name": "A",
    "guest_email": "a@test.com",
    "guest_phone": "3000000001",
    "items": [{
      "court_id": 1,
      "starts_at": "2026-09-25T13:00:00.000Z",
      "ends_at": "2026-09-25T14:00:00.000Z"
    }]
  }'
```

Un request debe ser `201` y el otro `409`. 13:00Z = 08:00 en Bogotá.

## Auth en Swagger

1. Authorize → **AuthGate**: valor de `AUTH` del `.env`.
2. `POST /login` con el admin de seed.
3. Authorize → **BearerAuth**: pega el JWT.

## IA / Cursor

Ver [`.cursorrules`](.cursorrules): dominio, UTC, unique de slots, sin registro público, pago simulado en el create.

## Scripts

```bash
npm run dev      # desarrollo
npm run build
npm start
```

export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'API Reservas de Canchas',
        version: '1.0.0',
        description: [
            'Backend de reservas de canchas (invitado sin registro + admin JWT).',
            '',
            '**Fechas:** ISO-8601 UTC. 08:00 en `America/Bogota` = `13:00Z`.',
            '',
            '**Pago:** `POST /api/v1/bookings` simula el pago por defecto. El invitado guarda `access_code` y lo envía en header `X-Access-Code` (Authorize → GuestAccess).',
            '**Límites:** máximo 30 días de anticipación; 8 creaciones por IP cada 15 minutos; 8 rangos y 24 slots por reserva.',
            '`date` en availability es fecha de calendario (no vale `2026-02-31`).',
            'Ampliar horario de cancha está permitido; encogerlo, cambiar timezone o `slot_minutes` con reservas activas responde `422`.',
            '',
            '**Prueba sugerida**',
            '1. `GET /api/v1/courts` y `GET .../availability?date=2026-09-25`',
            '2. `POST /api/v1/bookings` (mínimo 1 hora, alineado a 30/60 min)',
            '3. Vuelve a consultar availability: slots `booked`',
            '4. Authorize: header `auth` (valor de `.env` AUTH) + `POST /login`',
            '5. Authorize JWT (Bearer) y `POST /api/v1/admin/bookings/{id}/confirm`',
            '6. Cancela: se retiene 30% si ya pagó',
            '7. Dos reservas al mismo hueco: la segunda responde `409 SLOT_TAKEN`',
        ].join('\n'),
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local' }],
    tags: [
        { name: 'Health', description: 'Liveness / readiness' },
        { name: 'Auth', description: 'Login de admin' },
        { name: 'Canchas', description: 'Listado y calendario (público)' },
        { name: 'Reservas', description: 'Checkout de invitado' },
        { name: 'Admin Canchas', description: 'CRUD de canchas' },
        { name: 'Admin Reservas', description: 'Confirmar y cancelar reservas' },
    ],
    components: {
        securitySchemes: {
            AuthGate: {
                type: 'apiKey',
                in: 'header',
                name: 'auth',
                description: 'Valor de la variable AUTH del .env (gate de login)',
            },
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Token de POST /login',
            },
            GuestAccess: {
                type: 'apiKey',
                in: 'header',
                name: 'X-Access-Code',
                description: 'Código devuelto al crear la reserva. No va en la URL.',
            },
        },
        schemas: {
            Error: {
                type: 'object',
                properties: {
                    error: { type: 'string' },
                    code: { type: 'string', example: 'SLOT_TAKEN' },
                },
                required: ['error'],
            },
            Court: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    name: { type: 'string', example: 'Cancha de fútbol 1' },
                    description: { type: 'string' },
                    slot_minutes: { type: 'integer', enum: [30, 60], example: 60 },
                    price_per_hour: { type: 'string', example: '80000.00' },
                    opens_at: { type: 'string', example: '08:00:00' },
                    closes_at: { type: 'string', example: '22:00:00' },
                    timezone: { type: 'string', example: 'America/Bogota' },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                },
            },
            CourtWrite: {
                type: 'object',
                required: ['name', 'slot_minutes', 'price_per_hour', 'opens_at', 'closes_at'],
                description: 'Con reservas activas no se puede cambiar slot_minutes ni timezone, ni encoger el horario de forma que deje slots fuera.',
                properties: {
                    name: { type: 'string', example: 'Cancha squash 1' },
                    description: { type: 'string' },
                    slot_minutes: { type: 'integer', enum: [30, 60], example: 30 },
                    price_per_hour: { type: 'number', example: 35000 },
                    opens_at: { type: 'string', example: '09:00' },
                    closes_at: { type: 'string', example: '21:00' },
                    timezone: { type: 'string', example: 'America/Bogota' },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                },
            },
            AvailabilitySlot: {
                type: 'object',
                properties: {
                    start: { type: 'string', format: 'date-time', example: '2026-09-25T13:00:00.000Z' },
                    end: { type: 'string', format: 'date-time', example: '2026-09-25T14:00:00.000Z' },
                    status: { type: 'string', enum: ['free', 'held', 'booked'] },
                },
            },
            CourtAvailability: {
                type: 'object',
                properties: {
                    date: { type: 'string', example: '2026-09-25' },
                    court: { $ref: '#/components/schemas/Court' },
                    slots: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/AvailabilitySlot' },
                    },
                },
            },
            MultiAvailability: {
                type: 'object',
                properties: {
                    date: { type: 'string' },
                    courts: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/CourtAvailability' },
                    },
                },
            },
            BookingItemInput: {
                type: 'object',
                required: ['court_id', 'starts_at', 'ends_at'],
                properties: {
                    court_id: { type: 'integer', example: 1 },
                    starts_at: {
                        type: 'string',
                        format: 'date-time',
                        example: '2026-09-25T13:00:00.000Z',
                        description: 'UTC. No puede ser pasado ni más de 30 días en el futuro.',
                    },
                    ends_at: { type: 'string', format: 'date-time', example: '2026-09-25T15:00:00.000Z' },
                },
            },
            BookingItem: {
                type: 'object',
                properties: {
                    court_id: { type: 'integer' },
                    starts_at: { type: 'string', format: 'date-time' },
                    ends_at: { type: 'string', format: 'date-time' },
                    court: { $ref: '#/components/schemas/Court' },
                },
            },
            Booking: {
                type: 'object',
                properties: {
                    id: { type: 'integer', example: 1 },
                    access_code: { type: 'string', example: '49dbb779c840415481bbcd4fbafe40f5' },
                    status: {
                        type: 'string',
                        enum: ['pending_payment', 'paid', 'confirmed', 'cancelled', 'expired'],
                    },
                    guest_name: { type: 'string' },
                    guest_email: { type: 'string', format: 'email' },
                    guest_phone: { type: 'string' },
                    total_amount: { type: 'string', example: '160000.00' },
                    penalty_amount: { type: 'string', example: '0.00' },
                    refund_amount: { type: 'string', example: '0.00' },
                    paid_at: { type: 'string', format: 'date-time', nullable: true },
                    confirmed_at: { type: 'string', format: 'date-time', nullable: true },
                    cancelled_at: { type: 'string', format: 'date-time', nullable: true },
                    hold_expires_at: { type: 'string', format: 'date-time', nullable: true },
                    items: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/BookingItem' },
                    },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                },
            },
            BookingCreate: {
                type: 'object',
                required: ['guest_name', 'guest_email', 'guest_phone', 'items'],
                properties: {
                    guest_name: { type: 'string', example: 'Ana Perez' },
                    guest_email: { type: 'string', format: 'email', example: 'ana@test.com' },
                    guest_phone: { type: 'string', example: '3001234567' },
                    simulate_payment: {
                        type: 'boolean',
                        default: true,
                        description: 'Si es true (default), la reserva nace pagada. false deja hold de 15 min.',
                    },
                    items: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 8,
                        description: 'Hasta 8 rangos; el total expandido no puede superar 24 slots.',
                        items: { $ref: '#/components/schemas/BookingItemInput' },
                    },
                },
            },
            BookingList: {
                type: 'object',
                properties: {
                    total: { type: 'integer' },
                    bookings: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Booking' },
                    },
                },
            },
            LoginRequest: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                    email: { type: 'string', format: 'email', example: 'admin@jrtech.com' },
                    password: { type: 'string', example: 'tu-password-de-seed' },
                },
            },
            LoginResponse: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    token: { type: 'string' },
                },
            },
        },
        parameters: {
            DateQuery: {
                name: 'date',
                in: 'query',
                required: true,
                description: 'Fecha de calendario YYYY-MM-DD (se rechazan días inexistentes).',
                schema: { type: 'string', format: 'date', example: '2026-09-25' },
            },
            BookingId: {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' },
            },
            CourtId: {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' },
            },
        },
        responses: {
            BadRequest: {
                description: 'Validación',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            Unauthorized: {
                description: 'No autenticado',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            Forbidden: {
                description: 'Sin permiso',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            NotFound: {
                description: 'No encontrado',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            Conflict: {
                description: 'Horario ocupado',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            Unprocessable: {
                description: 'Estado inválido',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
            ServiceUnavailable: {
                description: 'No listo',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
            },
        },
    },
    paths: {
        '/health': {
            get: {
                tags: ['Health'],
                summary: 'Salud de API y MySQL',
                security: [],
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { status: { type: 'string', example: 'ok' } },
                                },
                            },
                        },
                    },
                    503: { $ref: '#/components/responses/ServiceUnavailable' },
                },
            },
        },
        '/login': {
            post: {
                tags: ['Auth'],
                summary: 'Login admin',
                security: [{ AuthGate: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
        },
        '/api/v1/courts': {
            get: {
                tags: ['Canchas'],
                summary: 'Listar canchas activas',
                security: [],
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: { type: 'array', items: { $ref: '#/components/schemas/Court' } },
                            },
                        },
                    },
                },
            },
        },
        '/api/v1/courts/availability': {
            get: {
                tags: ['Canchas'],
                summary: 'Disponibilidad de varias canchas',
                security: [],
                parameters: [
                    { $ref: '#/components/parameters/DateQuery' },
                    {
                        name: 'court_ids',
                        in: 'query',
                        schema: { type: 'string', example: '1,2' },
                        description: 'IDs separados por coma. Si se omite, todas las activas.',
                    },
                ],
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/MultiAvailability' } } },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                },
            },
        },
        '/api/v1/courts/{id}': {
            get: {
                tags: ['Canchas'],
                summary: 'Detalle de cancha activa',
                security: [],
                parameters: [{ $ref: '#/components/parameters/CourtId' }],
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Court' } } },
                    },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/api/v1/courts/{id}/availability': {
            get: {
                tags: ['Canchas'],
                summary: 'Disponibilidad de una cancha',
                security: [],
                parameters: [
                    { $ref: '#/components/parameters/CourtId' },
                    { $ref: '#/components/parameters/DateQuery' },
                ],
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/CourtAvailability' } } },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/api/v1/bookings': {
            post: {
                tags: ['Reservas'],
                summary: 'Crear reserva (pago simulado por defecto)',
                security: [],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingCreate' } } },
                },
                responses: {
                    201: {
                        description: 'Creada. status=paid si simulate_payment=true',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    409: { $ref: '#/components/responses/Conflict' },
                    429: {
                        description: 'Demasiadas reservas desde esta IP',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
                    },
                },
            },
        },
        '/api/v1/bookings/mine': {
            get: {
                tags: ['Reservas'],
                summary: 'Consultar mi reserva',
                security: [{ GuestAccess: [] }],
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/api/v1/bookings/pay': {
            post: {
                tags: ['Reservas'],
                summary: 'Pagar reserva en hold (solo si simulate_payment=false)',
                security: [{ GuestAccess: [] }],
                responses: {
                    200: {
                        description: 'Pagada',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    404: { $ref: '#/components/responses/NotFound' },
                    422: { $ref: '#/components/responses/Unprocessable' },
                },
            },
        },
        '/api/v1/bookings/cancel': {
            post: {
                tags: ['Reservas'],
                summary: 'Cancelar reserva (antes de que empiece; 30% si ya pagó)',
                security: [{ GuestAccess: [] }],
                responses: {
                    200: {
                        description: 'Cancelada',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    404: { $ref: '#/components/responses/NotFound' },
                    422: { $ref: '#/components/responses/Unprocessable' },
                },
            },
        },
        '/api/v1/admin/courts': {
            get: {
                tags: ['Admin Canchas'],
                summary: 'Listar todas las canchas',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'OK',
                        content: {
                            'application/json': {
                                schema: { type: 'array', items: { $ref: '#/components/schemas/Court' } },
                            },
                        },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                },
            },
            post: {
                tags: ['Admin Canchas'],
                summary: 'Crear cancha',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/CourtWrite' } } },
                },
                responses: {
                    201: {
                        description: 'Creada',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Court' } } },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    409: { $ref: '#/components/responses/Conflict' },
                },
            },
        },
        '/api/v1/admin/courts/{id}': {
            get: {
                tags: ['Admin Canchas'],
                summary: 'Detalle de cancha (incluye inactivas)',
                security: [{ BearerAuth: [] }],
                parameters: [{ $ref: '#/components/parameters/CourtId' }],
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Court' } } },
                    },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
            put: {
                tags: ['Admin Canchas'],
                summary: 'Reemplazar cancha',
                description: '422 si el nuevo horario/timezone/slot deja reservas activas inválidas.',
                security: [{ BearerAuth: [] }],
                parameters: [{ $ref: '#/components/parameters/CourtId' }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { $ref: '#/components/schemas/CourtWrite' } } },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Court' } } },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    404: { $ref: '#/components/responses/NotFound' },
                    422: { $ref: '#/components/responses/Unprocessable' },
                },
            },
            patch: {
                tags: ['Admin Canchas'],
                summary: 'Actualizar campos (ej. status)',
                description: '422 si el nuevo horario/timezone/slot deja reservas activas inválidas.',
                security: [{ BearerAuth: [] }],
                parameters: [{ $ref: '#/components/parameters/CourtId' }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/CourtWrite' },
                            example: { status: 'inactive' },
                        },
                    },
                },
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Court' } } },
                    },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
            delete: {
                tags: ['Admin Canchas'],
                summary: 'Eliminar cancha',
                description:
                    '422 si la cancha tiene reservas asociadas. No se borra en cascada: desactívala en su lugar.',
                security: [{ BearerAuth: [] }],
                parameters: [{ $ref: '#/components/parameters/CourtId' }],
                responses: {
                    200: {
                        description: 'Eliminada',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: { ok: { type: 'boolean', example: true } },
                                },
                            },
                        },
                    },
                    400: { $ref: '#/components/responses/BadRequest' },
                    401: { $ref: '#/components/responses/Unauthorized' },
                    403: { $ref: '#/components/responses/Forbidden' },
                    404: { $ref: '#/components/responses/NotFound' },
                    422: { $ref: '#/components/responses/Unprocessable' },
                },
            },
        },
        '/api/v1/admin/bookings': {
            get: {
                tags: ['Admin Reservas'],
                summary: 'Listar reservas',
                security: [{ BearerAuth: [] }],
                parameters: [
                    {
                        name: 'status',
                        in: 'query',
                        schema: {
                            type: 'string',
                            enum: ['pending_payment', 'paid', 'confirmed', 'cancelled', 'expired'],
                        },
                    },
                    { name: 'guest_email', in: 'query', schema: { type: 'string' } },
                    { name: 'court_id', in: 'query', schema: { type: 'integer' } },
                    { name: 'date', in: 'query', schema: { type: 'string', format: 'date', example: '2026-09-25' } },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
                    { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
                ],
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingList' } } },
                    },
                    401: { $ref: '#/components/responses/Unauthorized' },
                },
            },
        },
        '/api/v1/admin/bookings/{id}': {
            get: {
                tags: ['Admin Reservas'],
                summary: 'Detalle de reserva',
                security: [{ BearerAuth: [] }],
                parameters: [{ $ref: '#/components/parameters/BookingId' }],
                responses: {
                    200: {
                        description: 'OK',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
                    },
                    404: { $ref: '#/components/responses/NotFound' },
                },
            },
        },
        '/api/v1/admin/bookings/{id}/confirm': {
            post: {
                tags: ['Admin Reservas'],
                summary: 'Confirmar reserva pagada',
                security: [{ BearerAuth: [] }],
                parameters: [{ $ref: '#/components/parameters/BookingId' }],
                responses: {
                    200: {
                        description: 'Confirmada',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
                    },
                    404: { $ref: '#/components/responses/NotFound' },
                    422: { $ref: '#/components/responses/Unprocessable' },
                },
            },
        },
        '/api/v1/admin/bookings/{id}/cancel': {
            post: {
                tags: ['Admin Reservas'],
                summary: 'Cancelar reserva (antes de que empiece; 30% si pagó/confirmó)',
                security: [{ BearerAuth: [] }],
                parameters: [{ $ref: '#/components/parameters/BookingId' }],
                responses: {
                    200: {
                        description: 'Cancelada',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } },
                    },
                    404: { $ref: '#/components/responses/NotFound' },
                    422: { $ref: '#/components/responses/Unprocessable' },
                },
            },
        },
    },
};

# 🚀 Base TypeScript Backend

Base profesional para proyectos de backend con Node.js, Express, TypeScript y MySQL.

## ✨ Características

- **Express + TypeScript** - API REST tipada y robusta
- **Sequelize ORM** - Gestión de base de datos MySQL
- **Autenticación JWT** - Sistema completo de auth con roles
- **Sistema de Archivos Profesional** - Upload, thumbnails, optimización de imágenes
- **Rate Limiting** - Protección contra ataques de fuerza bruta
- **Envío de Emails** - Integración con Nodemailer
- **Hot Reload** - Desarrollo ágil con Nodemon

---

## 📁 Estructura del Proyecto

```
src/
├── config/
│   └── database.ts          # Configuración de Sequelize
├── middlewares/
│   ├── auth.ts              # Middleware de autenticación
│   ├── jwt.ts               # Utilidades JWT
│   ├── validateRequired.ts  # Validación de campos
│   └── verifyRoles.ts       # Verificación de roles
├── models/
│   ├── users.ts             # Modelo de usuarios
│   ├── profile.ts           # Modelo de perfiles
│   └── file.ts              # Modelo de archivos
├── routes/
│   ├── admin/               # Rutas de administración
│   ├── auth/                # Login y registro
│   ├── file/                # Gestión de archivos
│   └── users/               # Rutas de usuarios
├── services/
│   └── fileService.ts       # Lógica de negocio de archivos
├── storage/                 # Sistema de almacenamiento
│   ├── StorageProvider.ts   # Interface abstracta
│   ├── LocalStorageProvider.ts
│   ├── FileProcessor.ts     # Procesamiento de imágenes (Sharp)
│   ├── HashService.ts       # Checksums SHA-256
│   └── CleanupService.ts    # Limpieza automática
├── utils/
│   ├── fileUtils.ts         # Utilidades de archivos
│   └── email.ts             # Envío de correos
├── types/
│   └── express.d.ts         # Extensiones de tipos
├── main_routes.ts           # Router principal
├── seed.ts                  # Datos iniciales
└── index.ts                 # Entry point
```

---

## 🛠️ Instalación

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd base_ts

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
npm run dev

# Compilar para producción
npm run build
npm start
```

---

## ⚙️ Configuración

Crear archivo `.env` en la raíz del proyecto:

```env
# ──────────────── DATABASE ──────────────── #
DB_NAME=base_ts
DB_USER=root
DB_PASSWORD=tu_password
DB_HOST=localhost
DB_PORT=3306

# ──────────────── SERVER ──────────────── #
PORT=3000
JWT_SECRET=tu_secreto_jwt_seguro_aqui
AUTH=auth
BACKEND_URL_UPLOADS=http://localhost:3000/uploads/

# ──────────────── EMAIL ──────────────── #
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password
```

---

## 📤 Sistema de Archivos

### Estructura de Almacenamiento

```
uploads/
├── images/
│   ├── originals/     # Imágenes originales
│   ├── thumbnails/    # Miniaturas 300x300 (WebP)
│   └── optimized/     # Versiones optimizadas (WebP)
├── documents/         # PDFs, Word, Excel
├── other/             # Otros archivos
└── temp/              # Temporales (limpieza automática)
```

### Características

| Feature | Descripción |
|---------|-------------|
| 🖼️ **Thumbnails** | Generación automática 300x300 en WebP |
| ⚡ **Optimización** | Compresión inteligente con Sharp |
| 🔐 **Hash SHA-256** | Verificación de integridad |
| 🔄 **Deduplicación** | Detecta archivos duplicados |
| 🧹 **Auto-limpieza** | Elimina temporales cada 6 horas |

### Tipos de Archivo Permitidos

**Imágenes:** JPEG, PNG, GIF, WebP, AVIF, SVG  
**Documentos:** PDF, DOC, DOCX, XLS, XLSX, TXT, CSV

---

## 🔌 API Endpoints

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registro de usuario |
| POST | `/auth/login` | Iniciar sesión |

### Archivos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/files` | Listar todos los archivos |
| GET | `/files/:id` | Obtener archivo por ID |
| GET | `/files/stats` | Estadísticas de almacenamiento |
| POST | `/files` | Subir archivo(s) |
| PUT | `/files/:id` | Actualizar archivo |
| DELETE | `/files/:id` | Eliminar archivo |
| POST | `/files/cleanup` | Ejecutar limpieza manual |
| POST | `/files/check-duplicate` | Verificar duplicado por hash |

### Ejemplo: Subir Archivo

```bash
curl -X POST http://localhost:3000/files \
  -F "name=mi-archivo" \
  -F "mainFile=@/path/to/image.jpg" \
  -F "additionalFiles=@/path/to/doc.pdf"
```

### Respuesta

```json
{
  "message": "Archivo creado exitosamente",
  "data": {
    "id": 1,
    "name": "mi-archivo",
    "mainFile": {
      "originalname": "image.jpg",
      "storedName": "abc123.jpg",
      "size": 102400,
      "hash": "sha256...",
      "url": "http://localhost:3000/uploads/images/originals/abc123.jpg",
      "thumbnailUrl": "http://localhost:3000/uploads/images/thumbnails/abc123_thumb.webp",
      "optimizedUrl": "http://localhost:3000/uploads/images/optimized/abc123_opt.webp"
    }
  }
}
```

---

## 🧩 Extensibilidad

El sistema de almacenamiento usa el **patrón Strategy**, permitiendo agregar nuevos proveedores fácilmente:

```typescript
// Implementar para S3, MinIO, etc.
class S3StorageProvider implements StorageProvider {
  async upload(file: InputFile): Promise<StoredFile> { ... }
  async delete(fileId: string): Promise<boolean> { ... }
  // ...
}
```

---

## 📦 Dependencias Principales

| Paquete | Versión | Uso |
|---------|---------|-----|
| express | ^4.18 | Framework web |
| sequelize | ^6.37 | ORM para MySQL |
| sharp | ^0.33 | Procesamiento de imágenes |
| jsonwebtoken | ^9.0 | Autenticación JWT |
| multer | ^1.4 | Upload de archivos |
| bcrypt | ^5.1 | Hash de contraseñas |
| nodemailer | ^7.0 | Envío de emails |

---

## 🚀 Scripts

```bash
npm run dev      # Desarrollo con hot-reload
npm run build    # Compilar TypeScript
npm start        # Ejecutar build de producción
```

---

## 📝 Licencia

Proyecto privado - Todos los derechos reservados.
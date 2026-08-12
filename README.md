# Sistema de Empresas — PoC 2 (Módulo de Administración)

Prueba de concepto de un sistema web multiempresa: un grupo de hasta 40 empresas
(ampliable) accede cada una a su propia cuenta, y un **gestor principal** administra
las cuentas desde un **Módulo de Administración** invisible para las empresas.

## Qué incluye esta primera entrega

- **Autenticación** con clave (1–40, o `AdminGral` para el gestor) + contraseña.
- **Módulo de Administración** (solo visible/accesible para `AdminGral`):
  - Registrar empresas asignando clave y nombre; genera una contraseña inicial segura.
  - Editar el nombre de una empresa.
  - Restablecer la contraseña de una empresa (genera una nueva temporal).
  - Dar de baja / reactivar empresas (baja lógica, se conserva el historial).
  - Tabla `usuarios` creada localmente en SQLite al arrancar el sistema por primera vez.
- **Panel base para empresas**: pantalla de bienvenida (lista para recibir los próximos
  módulos de información) + opción de cambiar su propia contraseña.
- **Aislamiento total de datos**: cada empresa solo puede ver su propia información;
  las rutas nunca confían en un id enviado por el navegador, siempre usan la sesión.

## Seguridad implementada

| Medida | Detalle |
|---|---|
| Contraseñas | Hasheadas con `bcrypt` (nunca se guardan ni se devuelven en texto plano) |
| Sesiones | Cookie `httpOnly`, `sameSite=strict`, `secure` en producción, regenerada en cada login |
| Fuerza bruta | Límite de intentos por IP (`express-rate-limit`) + bloqueo de cuenta tras 5 intentos fallidos (15 min) |
| Cabeceras HTTP | `helmet` (CSP, HSTS, etc.) |
| Inyección SQL | Consultas parametrizadas (`better-sqlite3` prepared statements) |
| Aislamiento entre empresas | Cada consulta se filtra por la empresa de la sesión activa, nunca por un parámetro del cliente |
| Módulo de administración | No se sirve como carpeta estática; el servidor valida el rol antes de entregar el HTML — una empresa que intente entrar por URL directa recibe 404 |
| Auditoría | Tabla `auditoria` registra altas, bajas, resets y logins fallidos |

## Estructura del proyecto

```
poc2/
├── server.js                 # Punto de entrada, seguridad global y ruteo por rol
├── src/
│   ├── db/index.js           # Conexión SQLite, creación de tablas y semilla del admin
│   ├── middleware/auth.js    # requireAuth / requireAdmin / requireEmpresa
│   ├── routes/auth.js        # login, logout, cambio de contraseña
│   ├── routes/admin.js       # CRUD de usuarios empresariales (solo admin)
│   ├── routes/panel.js       # Datos propios de cada empresa
│   └── utils.js               # Generador de contraseñas y validaciones
├── public/
│   ├── login.html / js/login.js
│   ├── admin/index.html + admin/js/admin.js     # Módulo de Administración
│   └── panel/index.html + panel/js/panel.js     # Panel de la empresa
└── data/sistema.db           # Base de datos SQLite (se crea sola, no se sube a Git)
```

## Cómo correrlo localmente

```bash
npm install
cp .env.example .env
# Edita .env y coloca un SESSION_SECRET propio (ver instrucciones dentro del archivo)
npm start
```

Abre `http://localhost:3000`. La primera vez que arranca, el sistema crea automáticamente
la cuenta del gestor:

- **Clave:** `AdminGral`
- **Contraseña inicial:** `Temporal1`

⚠️ Cambia esa contraseña desde el propio sistema (opción de cambiar contraseña) apenas
lo pruebes por primera vez.

## Publicarlo en GitHub

El `.gitignore` ya excluye `node_modules/`, el archivo `.env` y la base de datos
(`data/*.db`), para que no subas secretos ni datos reales al repositorio:

```bash
git add .
git commit -m "PoC 2: sistema multiempresa con Modulo de Administracion"
git branch -M main
git remote add origin <URL-de-tu-repositorio>
git push -u origin main
```

## Desplegarlo en Render / Railway

1. Sube el repo a GitHub (paso anterior).
2. En Render/Railway, crea un **Web Service** apuntando al repo.
   - Build command: `npm install`
   - Start command: `npm start`
3. Configura las variables de entorno del servicio (no subas tu `.env`):
   - `SESSION_SECRET` (una cadena larga y aleatoria distinta a la de desarrollo)
   - `NODE_ENV=production`
   - `ADMIN_CLAVE` y `ADMIN_PASSWORD_INICIAL` (opcional, solo se usan la primera vez)
4. **Importante sobre el almacenamiento:** en el plan gratuito de Render, el disco no es
   persistente (se reinicia con cada despliegue), por lo que la base de datos SQLite se
   perdería. Para producción real conviene:
   - Usar un **disco persistente** (Render ofrece "Persistent Disks" en planes pagos), o
   - Migrar a **PostgreSQL** (Render/Railway ofrecen una base gratuita); la capa `src/db`
     está aislada del resto del código precisamente para facilitar ese cambio más adelante.

## Próximos módulos

Este PoC deja la base lista (autenticación, roles, sesión, aislamiento por empresa) para
que el segundo módulo agregue la información real que cada empresa debe consultar,
reutilizando `requireEmpresa` y el panel ya existente en `/panel`.

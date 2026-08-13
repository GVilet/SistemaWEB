require('dotenv').config(); 
const fs = require('fs'); 
const path = require('path'); 
const express = require('express'); 
const helmet = require('helmet'); 
const cors = require('cors'); 
const session = require('express-session'); 
const FileStore = require('session-file-store')(session); 
const authRoutes = require('./src/routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
// Carpeta donde se guardan las sesiones activas (un archivo por sesion). 
const SESSIONS_DIR = path.join(__dirname, 'data', 'sessions'); 
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

app.set('trust proxy', 1); // necesario detras de Render/Railway para que "secure" cookies funcionen

// ---------------------------------------------------------------------
// Seguridad de cabeceras HTTP
// ---------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
      fontSrc: ["'self'", 'fonts.gstatic.com'],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({ origin: false })); // el frontend se sirve desde el mismo origen; no se permiten llamadas cross-origin

app.use(express.json({ limit: '100kb' }));

// ---------------------------------------------------------------------
// Sesiones (cookie firmada, httpOnly, secure en produccion)
// ---------------------------------------------------------------------
app.use(session({ store: new FileStore({ path: SESSIONS_DIR, ttl: 8 * 60 * 60, retries: 0, logFn: () => {}, }), name: 'sid'
//  app.use(session({
//  name: 'sid',
// secret: process.env.SESSION_SECRET || 'CAMBIA_ESTE_SECRETO_EN_.env',
//  resave: false,
//  saveUninitialized: false,
//  cookie: {
//    httpOnly: true,
//    secure: isProd,          // en produccion (HTTPS) exige cookie solo por HTTPS
//    sameSite: 'strict',      // evita que la cookie se envie desde otros sitios (mitiga CSRF)
//    maxAge: 8 * 60 * 60 * 1000, // 8 horas
//  },
// }));

// ---------------------------------------------------------------------
// API
// ---------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/panel', panelRoutes);

// ---------------------------------------------------------------------
// Paginas: el Modulo de Administracion NO se sirve como carpeta estatica.
// Se valida la sesion en el servidor antes de entregar el HTML, por lo que
// una empresa que intente entrar a /admin por URL directa es rechazada.
// ---------------------------------------------------------------------
function paginaProtegida(rolRequerido, archivo) {
  return (req, res) => {
    if (!req.session.usuario) return res.redirect('/');
    if (req.session.usuario.rol !== rolRequerido) return res.status(404).send('No encontrado');
    res.sendFile(path.join(__dirname, 'public', archivo));
  };
}

app.get('/admin', paginaProtegida('admin', 'admin/index.html'));
app.get('/panel', paginaProtegida('empresa', 'panel/index.html'));

// Archivos estaticos generales (login, css, js compartido). No incluye /admin ni /panel.
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/admin/js', express.static(path.join(__dirname, 'public', 'admin', 'js')));
app.use('/panel/js', express.static(path.join(__dirname, 'public', 'panel', 'js')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// 404 generico (no revela estructura interna)
app.use((req, res) => {
  res.status(404).send('No encontrado');
});

// Manejador de errores
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Sistema corriendo en http://localhost:${PORT}`);
});

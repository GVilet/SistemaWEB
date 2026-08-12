const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { db, registrarAuditoria } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { passwordCumpleMinimo } = require('../utils');

const router = express.Router();

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

// Limite de peticiones al login para dificultar ataques de fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const { clave, password } = req.body || {};

  if (!clave || !password) {
    return res.status(400).json({ error: 'Clave y contrasena son obligatorias.' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE clave = ?').get(String(clave).trim());

  if (!usuario) {
    registrarAuditoria({ clave, accion: 'LOGIN_FALLIDO', detalle: 'Clave inexistente', ip: req.ip });
    return res.status(401).json({ error: 'Clave o contrasena incorrectas.' });
  }

  if (!usuario.activo) {
    registrarAuditoria({ usuario_id: usuario.id, clave, accion: 'LOGIN_RECHAZADO', detalle: 'Usuario dado de baja', ip: req.ip });
    return res.status(403).json({ error: 'Esta cuenta esta dada de baja. Contacta al administrador.' });
  }

  if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
    return res.status(403).json({ error: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta mas tarde.' });
  }

  const passwordOk = bcrypt.compareSync(password, usuario.password_hash);

  if (!passwordOk) {
    const intentos = usuario.intentos_fallidos + 1;
    let bloqueado_hasta = null;
    if (intentos >= MAX_INTENTOS) {
      bloqueado_hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000).toISOString();
    }
    db.prepare('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?')
      .run(intentos, bloqueado_hasta, usuario.id);

    registrarAuditoria({ usuario_id: usuario.id, clave, accion: 'LOGIN_FALLIDO', detalle: `Password incorrecta (intento ${intentos})`, ip: req.ip });
    return res.status(401).json({ error: 'Clave o contrasena incorrectas.' });
  }

  // Login correcto: reiniciar contador de intentos
  db.prepare('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?').run(usuario.id);

  // Regenerar sesion para prevenir "session fixation"
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Error al iniciar sesion.' });

    req.session.usuario = {
      id: usuario.id,
      clave: usuario.clave,
      rol: usuario.rol,
      nombre_empresa: usuario.nombre_empresa,
    };

    registrarAuditoria({ usuario_id: usuario.id, clave, accion: 'LOGIN_OK', ip: req.ip });

    res.json({
      ok: true,
      usuario: {
        clave: usuario.clave,
        rol: usuario.rol,
        nombre_empresa: usuario.nombre_empresa,
        debe_cambiar_password: !!usuario.debe_cambiar_password,
      },
    });
  });
});

router.post('/logout', requireAuth, (req, res) => {
  const clave = req.session.usuario?.clave;
  req.session.destroy(() => {
    res.clearCookie('sid');
    registrarAuditoria({ clave, accion: 'LOGOUT' });
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.session.usuario });
});

// Permite al usuario (empresa o admin) cambiar su propia contrasena.
// Esto cubre el requisito de "poder recordarla y/o modificarla" una vez autenticado.
router.post('/cambiar-password', requireAuth, (req, res) => {
  const { password_actual, password_nueva } = req.body || {};

  if (!passwordCumpleMinimo(password_nueva)) {
    return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 8 caracteres.' });
  }

  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.session.usuario.id);
  const ok = bcrypt.compareSync(password_actual || '', usuario.password_hash);
  if (!ok) {
    return res.status(401).json({ error: 'La contrasena actual no es correcta.' });
  }

  const nuevoHash = bcrypt.hashSync(password_nueva, 12);
  db.prepare(`
    UPDATE usuarios
    SET password_hash = ?, debe_cambiar_password = 0, actualizado_en = datetime('now')
    WHERE id = ?
  `).run(nuevoHash, usuario.id);

  registrarAuditoria({ usuario_id: usuario.id, clave: usuario.clave, accion: 'CAMBIO_PASSWORD_PROPIO' });

  res.json({ ok: true });
});

module.exports = router;

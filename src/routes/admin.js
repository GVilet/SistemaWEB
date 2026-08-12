const express = require('express');
const bcrypt = require('bcryptjs');
const { db, registrarAuditoria } = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { generarPasswordTemporal, esClaveEmpresaValida } = require('../utils');

const router = express.Router();

// Todas las rutas de este archivo requieren sesion de administrador.
router.use(requireAdmin);

// Lista completa de usuarios empresariales (nunca se envia el password_hash)
router.get('/usuarios', (req, res) => {
  const usuarios = db.prepare(`
    SELECT id, clave, nombre_empresa, activo, debe_cambiar_password, intentos_fallidos, bloqueado_hasta, creado_en, actualizado_en
    FROM usuarios
    WHERE rol = 'empresa'
    ORDER BY CAST(clave AS INTEGER) ASC
  `).all();
  res.json({ usuarios });
});

// 1. Registrar un nuevo usuario empresarial
router.post('/usuarios', (req, res) => {
  const { clave, nombre_empresa, password_inicial } = req.body || {};

  if (!esClaveEmpresaValida(clave)) {
    return res.status(400).json({ error: 'La clave debe ser un numero (por ejemplo del 1 al 40).' });
  }
  if (!nombre_empresa || String(nombre_empresa).trim().length < 2) {
    return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' });
  }

  const existente = db.prepare('SELECT id FROM usuarios WHERE clave = ?').get(String(clave));
  if (existente) {
    return res.status(409).json({ error: `La clave ${clave} ya esta asignada.` });
  }

  const passwordFinal = password_inicial && password_inicial.length >= 8
    ? password_inicial
    : generarPasswordTemporal();

  const hash = bcrypt.hashSync(passwordFinal, 12);

  const info = db.prepare(`
    INSERT INTO usuarios (clave, rol, nombre_empresa, password_hash, activo, debe_cambiar_password)
    VALUES (?, 'empresa', ?, ?, 1, 1)
  `).run(String(clave), String(nombre_empresa).trim(), hash);

  registrarAuditoria({
    usuario_id: req.session.usuario.id,
    clave: req.session.usuario.clave,
    accion: 'ALTA_USUARIO',
    detalle: `Creado usuario clave=${clave} empresa="${nombre_empresa}"`,
  });

  res.status(201).json({
    ok: true,
    usuario: { id: info.lastInsertRowid, clave: String(clave), nombre_empresa },
    password_inicial: passwordFinal, // se muestra UNA sola vez al gestor para que la entregue a la empresa
  });
});

// 2a. Editar datos de un usuario (nombre de empresa, estado activo)
router.put('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { nombre_empresa, activo } = req.body || {};

  const usuario = db.prepare(`SELECT * FROM usuarios WHERE id = ? AND rol = 'empresa'`).get(id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const nuevoNombre = (nombre_empresa && String(nombre_empresa).trim().length >= 2)
    ? String(nombre_empresa).trim()
    : usuario.nombre_empresa;
  const nuevoActivo = typeof activo === 'boolean' ? (activo ? 1 : 0) : usuario.activo;

  db.prepare(`
    UPDATE usuarios SET nombre_empresa = ?, activo = ?, actualizado_en = datetime('now') WHERE id = ?
  `).run(nuevoNombre, nuevoActivo, id);

  registrarAuditoria({
    usuario_id: req.session.usuario.id,
    clave: req.session.usuario.clave,
    accion: 'EDICION_USUARIO',
    detalle: `Editado id=${id} nombre="${nuevoNombre}" activo=${nuevoActivo}`,
  });

  res.json({ ok: true });
});

// 2b. Restablecer contrasena de un usuario (genera una nueva temporal)
router.post('/usuarios/:id/reset-password', (req, res) => {
  const { id } = req.params;
  const usuario = db.prepare(`SELECT * FROM usuarios WHERE id = ? AND rol = 'empresa'`).get(id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const nuevaPassword = generarPasswordTemporal();
  const hash = bcrypt.hashSync(nuevaPassword, 12);

  db.prepare(`
    UPDATE usuarios
    SET password_hash = ?, debe_cambiar_password = 1, intentos_fallidos = 0, bloqueado_hasta = NULL, actualizado_en = datetime('now')
    WHERE id = ?
  `).run(hash, id);

  registrarAuditoria({
    usuario_id: req.session.usuario.id,
    clave: req.session.usuario.clave,
    accion: 'RESET_PASSWORD',
    detalle: `Reseteo de password para id=${id}`,
  });

  res.json({ ok: true, password_inicial: nuevaPassword });
});

// 2c. Dar de baja (baja logica: se conserva el historial pero no puede iniciar sesion)
router.delete('/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const usuario = db.prepare(`SELECT * FROM usuarios WHERE id = ? AND rol = 'empresa'`).get(id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

  db.prepare(`UPDATE usuarios SET activo = 0, actualizado_en = datetime('now') WHERE id = ?`).run(id);

  registrarAuditoria({
    usuario_id: req.session.usuario.id,
    clave: req.session.usuario.clave,
    accion: 'BAJA_USUARIO',
    detalle: `Baja logica de id=${id} (clave ${usuario.clave})`,
  });

  res.json({ ok: true });
});

// Reactivar un usuario dado de baja
router.post('/usuarios/:id/reactivar', (req, res) => {
  const { id } = req.params;
  const usuario = db.prepare(`SELECT * FROM usuarios WHERE id = ? AND rol = 'empresa'`).get(id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });

  db.prepare(`UPDATE usuarios SET activo = 1, actualizado_en = datetime('now') WHERE id = ?`).run(id);

  registrarAuditoria({
    usuario_id: req.session.usuario.id,
    clave: req.session.usuario.clave,
    accion: 'REACTIVACION_USUARIO',
    detalle: `Reactivado id=${id}`,
  });

  res.json({ ok: true });
});

module.exports = router;

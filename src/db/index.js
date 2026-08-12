const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'sistema.db');
const db = new Database(DB_PATH);

// Configuracion de seguridad e integridad de SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------
// Creacion de tablas (idempotente: solo crea si no existen)
// ---------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    clave                 TEXT    NOT NULL UNIQUE,   -- '1'..'40' para empresas, 'AdminGral' para el administrador
    rol                   TEXT    NOT NULL CHECK (rol IN ('admin', 'empresa')),
    nombre_empresa        TEXT    NOT NULL,
    password_hash         TEXT    NOT NULL,
    activo                INTEGER NOT NULL DEFAULT 1,
    debe_cambiar_password INTEGER NOT NULL DEFAULT 1,
    intentos_fallidos     INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta       TEXT,
    creado_en             TEXT    NOT NULL DEFAULT (datetime('now')),
    actualizado_en        TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER,
    clave       TEXT,
    accion      TEXT NOT NULL,
    detalle     TEXT,
    ip          TEXT,
    creado_en   TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ---------------------------------------------------------------------
// Semilla del administrador general (solo si todavia no existe)
// ---------------------------------------------------------------------
function seedAdmin() {
  const claveAdmin = process.env.ADMIN_CLAVE || 'AdminGral';
  const passInicial = process.env.ADMIN_PASSWORD_INICIAL || 'Temporal1';

  const existente = db.prepare('SELECT id FROM usuarios WHERE clave = ?').get(claveAdmin);
  if (!existente) {
    const hash = bcrypt.hashSync(passInicial, 12);
    db.prepare(`
      INSERT INTO usuarios (clave, rol, nombre_empresa, password_hash, activo, debe_cambiar_password)
      VALUES (?, 'admin', 'Administracion General', ?, 1, 1)
    `).run(claveAdmin, hash);
    console.log(`[DB] Cuenta de administrador creada: ${claveAdmin} (recuerda cambiar la contrasena al primer ingreso)`);
  }
}

seedAdmin();

function registrarAuditoria({ usuario_id = null, clave = null, accion, detalle = null, ip = null }) {
  db.prepare(`
    INSERT INTO auditoria (usuario_id, clave, accion, detalle, ip)
    VALUES (?, ?, ?, ?, ?)
  `).run(usuario_id, clave, accion, detalle, ip);
}

module.exports = { db, registrarAuditoria };

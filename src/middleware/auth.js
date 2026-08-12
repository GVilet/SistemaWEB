// Exige que exista una sesion iniciada (cualquier rol)
function requireAuth(req, res, next) {
  if (!req.session || !req.session.usuario) {
    return res.status(401).json({ error: 'No autenticado. Inicia sesion para continuar.' });
  }
  next();
}

// Exige que la sesion sea del administrador general.
// Esto es lo que hace INVISIBLE el Modulo de Administracion para las empresas:
// ninguna ruta ni archivo de /admin responde si el rol no es 'admin'.
function requireAdmin(req, res, next) {
  if (!req.session || !req.session.usuario || req.session.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido.' });
  }
  next();
}

// Exige que la sesion sea de una empresa (usuario 1-40)
function requireEmpresa(req, res, next) {
  if (!req.session || !req.session.usuario || req.session.usuario.rol !== 'empresa') {
    return res.status(403).json({ error: 'Acceso restringido.' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, requireEmpresa };

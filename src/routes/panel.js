const express = require('express');
const { requireEmpresa } = require('../middleware/auth');

const router = express.Router();
router.use(requireEmpresa);

// Cada empresa solo puede ver su propia informacion: se usa req.session.usuario,
// nunca un id que venga del cliente, evitando que una empresa consulte datos de otra.
router.get('/resumen', (req, res) => {
  res.json({
    clave: req.session.usuario.clave,
    nombre_empresa: req.session.usuario.nombre_empresa,
    mensaje: 'Modulo de datos: proximamente. Este es el panel base para la empresa autenticada.',
  });
});

module.exports = router;

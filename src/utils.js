const crypto = require('crypto');

// Genera una contrasena temporal legible pero segura, ej: "Tx7-mK92-qL"
function generarPasswordTemporal() {
  const bloques = [];
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  for (let b = 0; b < 3; b++) {
    let bloque = '';
    for (let i = 0; i < 4; i++) {
      bloque += alfabeto[crypto.randomInt(0, alfabeto.length)];
    }
    bloques.push(bloque);
  }
  return bloques.join('-');
}

function esClaveEmpresaValida(clave) {
  return /^[1-9][0-9]?$/.test(String(clave).trim()); // 1..99 (cubre 1-40 y crecimiento futuro)
}

function passwordCumpleMinimo(password) {
  return typeof password === 'string' && password.length >= 8;
}

module.exports = { generarPasswordTemporal, esClaveEmpresaValida, passwordCumpleMinimo };

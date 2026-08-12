const toast = document.getElementById('toast');

function mostrarToast(mensaje, esError = false) {
  toast.textContent = mensaje;
  toast.classList.toggle('danger', esError);
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3200);
}

async function api(url, options = {}) {
  const resp = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Ocurrio un error.');
  return data;
}

async function iniciar() {
  try {
    const { usuario } = await api('/api/auth/me');
    document.getElementById('claveBadge').textContent = usuario.clave;
    document.getElementById('nombreEmpresaTag').textContent = usuario.nombre_empresa;
    document.getElementById('saludo').textContent = `Hola, ${usuario.nombre_empresa}`;
  } catch (err) {
    window.location.href = '/';
  }
}

document.getElementById('navCambiarPassword').addEventListener('click', () => {
  document.getElementById('vistaInicio').style.display = 'none';
  document.getElementById('vistaPassword').style.display = 'block';
});

document.getElementById('formPassword').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgError = document.getElementById('msgErrorPass');
  msgError.classList.remove('visible');
  try {
    await api('/api/auth/cambiar-password', {
      method: 'POST',
      body: JSON.stringify({
        password_actual: document.getElementById('passwordActual').value,
        password_nueva: document.getElementById('passwordNueva').value,
      }),
    });
    mostrarToast('Contrasena actualizada correctamente.');
    e.target.reset();
  } catch (err) {
    msgError.textContent = err.message;
    msgError.classList.add('visible');
  }
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

iniciar();

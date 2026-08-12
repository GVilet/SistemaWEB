const form = document.getElementById('formLogin');
const msgError = document.getElementById('msgError');
const btnSubmit = document.getElementById('btnSubmit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msgError.classList.remove('visible');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Ingresando...';

  const clave = document.getElementById('clave').value.trim();
  const password = document.getElementById('password').value;

  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clave, password }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || 'No se pudo iniciar sesion.');
    }

    if (data.usuario.rol === 'admin') {
      window.location.href = '/admin';
    } else {
      window.location.href = '/panel';
    }
  } catch (err) {
    msgError.textContent = err.message;
    msgError.classList.add('visible');
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Ingresar';
  }
});

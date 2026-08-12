const tbody = document.getElementById('tbodyUsuarios');
const contador = document.getElementById('contador');
const emptyState = document.getElementById('emptyState');

const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitulo = document.getElementById('modalTitulo');
const formUsuario = document.getElementById('formUsuario');
const usuarioIdInput = document.getElementById('usuarioId');
const claveInput = document.getElementById('claveInput');
const nombreEmpresaInput = document.getElementById('nombreEmpresa');
const passwordResultado = document.getElementById('passwordResultado');
const passwordTexto = document.getElementById('passwordTexto');
const toast = document.getElementById('toast');

let modoEdicion = false;

function mostrarToast(mensaje, esError = false) {
  toast.textContent = mensaje;
  toast.classList.toggle('danger', esError);
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3200);
}

async function api(url, options = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Ocurrio un error.');
  return data;
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function cargarUsuarios() {
  try {
    const { usuarios } = await api('/api/admin/usuarios');
    contador.textContent = `${usuarios.length} empresa(s) registrada(s)`;
    tbody.innerHTML = '';
    emptyState.style.display = usuarios.length ? 'none' : 'block';

    usuarios.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="clave-chip">${u.clave}</span></td>
        <td>${u.nombre_empresa}</td>
        <td>
          <span class="status-pill ${u.activo ? 'activo' : 'baja'}">
            ${u.activo ? 'Activa' : 'De baja'}
          </span>
        </td>
        <td class="mono" style="font-size:12px; color:var(--ink-soft)">${formatearFecha(u.actualizado_en)}</td>
        <td style="text-align:right; white-space:nowrap">
          <button class="btn-link" data-accion="editar" data-id="${u.id}" data-clave="${u.clave}" data-nombre="${u.nombre_empresa}">Editar</button>
          <button class="btn-link" data-accion="reset" data-id="${u.id}">Restablecer</button>
          <button class="btn-link danger" data-accion="${u.activo ? 'baja' : 'reactivar'}" data-id="${u.id}">
            ${u.activo ? 'Dar de baja' : 'Reactivar'}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    mostrarToast(err.message, true);
  }
}

// ---------- Modal: alta / edicion ----------
function abrirModalNuevo() {
  modoEdicion = false;
  modalTitulo.textContent = 'Registrar empresa';
  usuarioIdInput.value = '';
  claveInput.value = '';
  claveInput.disabled = false;
  nombreEmpresaInput.value = '';
  passwordResultado.style.display = 'none';
  modalBackdrop.classList.add('visible');
}

function abrirModalEditar(id, clave, nombre) {
  modoEdicion = true;
  modalTitulo.textContent = `Editar empresa · clave ${clave}`;
  usuarioIdInput.value = id;
  claveInput.value = clave;
  claveInput.disabled = true;
  nombreEmpresaInput.value = nombre;
  passwordResultado.style.display = 'none';
  modalBackdrop.classList.add('visible');
}

function cerrarModal() {
  modalBackdrop.classList.remove('visible');
}

document.getElementById('btnNuevo').addEventListener('click', abrirModalNuevo);
document.getElementById('btnCancelar').addEventListener('click', cerrarModal);

formUsuario.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    if (modoEdicion) {
      await api(`/api/admin/usuarios/${usuarioIdInput.value}`, {
        method: 'PUT',
        body: JSON.stringify({ nombre_empresa: nombreEmpresaInput.value }),
      });
      mostrarToast('Empresa actualizada.');
      cerrarModal();
      cargarUsuarios();
    } else {
      const data = await api('/api/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({ clave: claveInput.value, nombre_empresa: nombreEmpresaInput.value }),
      });
      passwordTexto.textContent = data.password_inicial;
      passwordResultado.style.display = 'block';
      mostrarToast('Empresa registrada correctamente.');
      cargarUsuarios();
    }
  } catch (err) {
    mostrarToast(err.message, true);
  }
});

// ---------- Acciones de la tabla ----------
tbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-accion]');
  if (!btn) return;
  const { accion, id, clave, nombre } = btn.dataset;

  if (accion === 'editar') return abrirModalEditar(id, clave, nombre);

  if (accion === 'reset') {
    if (!confirm('¿Generar una nueva contrasena temporal para esta empresa?')) return;
    try {
      const data = await api(`/api/admin/usuarios/${id}/reset-password`, { method: 'POST' });
      alert(`Nueva contrasena temporal:\n\n${data.password_inicial}\n\nEntregala a la empresa; se le pedira cambiarla al ingresar.`);
      cargarUsuarios();
    } catch (err) {
      mostrarToast(err.message, true);
    }
    return;
  }

  if (accion === 'baja') {
    if (!confirm('¿Dar de baja a esta empresa? No podra iniciar sesion hasta que se reactive.')) return;
    try {
      await api(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
      mostrarToast('Empresa dada de baja.');
      cargarUsuarios();
    } catch (err) {
      mostrarToast(err.message, true);
    }
    return;
  }

  if (accion === 'reactivar') {
    try {
      await api(`/api/admin/usuarios/${id}/reactivar`, { method: 'POST' });
      mostrarToast('Empresa reactivada.');
      cargarUsuarios();
    } catch (err) {
      mostrarToast(err.message, true);
    }
  }
});

document.getElementById('btnLogout').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
});

cargarUsuarios();

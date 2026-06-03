// ============================================
// GASTOS COMPARTIDOS — Agregar gasto script.js
// FIX: ya no re-consulta usuarios para guardar
// ============================================

const usuario = requireUsuario()
let quienSeleccionado = usuario.nombre === 'Esposo' ? 'esposo' : 'esposa'
let quienId           = usuario.id   // FIX: guardamos el id directamente
let categoriaSeleccionada = null

document.getElementById('txt-usuario').textContent =
    (usuario.nombre === 'Esposo' ? '👨' : '👩') + ' ' + usuario.nombre

document.getElementById('fecha').value = new Date().toISOString().split('T')[0]

// ── Categorías ───────────────────────────────
function renderCategorias() {
    const grid = document.getElementById('categorias-grid')
    grid.innerHTML = ''
    CATEGORIAS.forEach(cat => {
        const btn = document.createElement('button')
        btn.className = 'cat-btn'
        btn.innerHTML = `<span>${cat.icono}</span>${cat.nombre}`
        btn.onclick = () => seleccionarCategoria(cat.id, btn)
        grid.appendChild(btn)
    })
}

function seleccionarCategoria(id, btn) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('activo'))
    btn.classList.add('activo')
    categoriaSeleccionada = id
}

// ── Quién gasta ──────────────────────────────
// FIX: cuando cambia quién gasta, también actualiza quienId
async function seleccionarQuien(quien) {
    quienSeleccionado = quien
    document.getElementById('quien-esposo').classList.toggle('activo', quien === 'esposo')
    document.getElementById('quien-esposa').classList.toggle('activo', quien === 'esposa')

    // Solo busca en BD si eligió al otro usuario (no al que inició sesión)
    const nombreBuscado = quien === 'esposo' ? 'Esposo' : 'Esposa'
    if (usuario.nombre === nombreBuscado) {
        quienId = usuario.id
    } else {
        // Busca el id del otro usuario
        const { data, error } = await db
            .from('gc_usuarios')
            .select('id')
            .eq('nombre', nombreBuscado)
            .single()
        if (!error && data) quienId = data.id
    }
}

// ── Guardar ──────────────────────────────────
async function guardarGasto() {
    const descripcion = document.getElementById('descripcion').value.trim()
    const monto       = parseFloat(document.getElementById('monto').value)
    const fecha       = document.getElementById('fecha').value

    if (!descripcion)              { mostrarToast('Escribe una descripción', 'error'); return }
    if (!monto || monto <= 0)      { mostrarToast('Ingresa un monto válido', 'error'); return }
    if (!categoriaSeleccionada)    { mostrarToast('Selecciona una categoría', 'error'); return }
    if (!fecha)                    { mostrarToast('Selecciona una fecha', 'error'); return }
    if (!quienId)                  { mostrarToast('Error: usuario no identificado', 'error'); return }

    const btn = document.getElementById('btn-guardar')
    btn.disabled = true
    btn.textContent = 'Guardando...'

    try {
        // FIX: usa quienId que ya está en memoria, sin re-consultar usuarios
        const { error } = await db.from('gc_gastos').insert({
            usuario_id:   quienId,
            categoria_id: categoriaSeleccionada,
            descripcion,
            monto,
            fecha
        })

        if (error) throw error

        mostrarToast('✅ Gasto guardado')

        document.getElementById('descripcion').value = ''
        document.getElementById('monto').value = ''
        document.getElementById('fecha').value = new Date().toISOString().split('T')[0]
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('activo'))
        categoriaSeleccionada = null

        setTimeout(() => window.location.href = '/gastos-compartidos/gastos/', 1000)

    } catch (err) {
        console.error('Error al guardar:', err)
        mostrarToast('Error guardando: ' + (err.message || 'desconocido'), 'error')
    } finally {
        btn.disabled = false
        btn.textContent = '💾 Guardar gasto'
    }
}

renderCategorias()
seleccionarQuien(quienSeleccionado)

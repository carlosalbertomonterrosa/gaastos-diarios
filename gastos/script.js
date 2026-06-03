// ============================================
// GASTOS COMPARTIDOS — Gastos script.js
// FIX: rangoMes(), join correcto, formatFecha
// ============================================

const usuario = requireUsuario()
const params  = new URLSearchParams(window.location.search)
let mesActual  = params.get('mes')  ? parseInt(params.get('mes'))  : new Date().getMonth() + 1
let anioActual = params.get('anio') ? parseInt(params.get('anio')) : new Date().getFullYear()

document.getElementById('txt-usuario').textContent =
    (usuario.nombre === 'Esposo' ? '👨' : '👩') + ' ' + usuario.nombre

async function cargarGastos() {
    const cont = document.getElementById('acordeon-contenedor')
    cont.innerHTML = '<div class="spinner"></div>'

    const mesNombre = new Date(anioActual, mesActual - 1, 1)
        .toLocaleString('es-CO', { month: 'long', year: 'numeric' })
    document.getElementById('txt-mes').textContent =
        mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)

    // FIX: rangoMes correcto
    const { inicio, fin } = rangoMes(anioActual, mesActual)

    const { data: gastos, error } = await db
        .from('gc_gastos')
        .select('*, gc_usuarios(id, nombre), gc_categorias(id, nombre, icono)')
        .gte('fecha', inicio)
        .lte('fecha', fin)
        .order('fecha', { ascending: false })

    if (error) {
        cont.innerHTML = '<p style="color:#E74C3C;text-align:center;padding:2em">Error cargando gastos:<br>' + error.message + '</p>'
        console.error(error)
        return
    }

    // Agrupa por categoría
    const porCategoria = {}
    CATEGORIAS.forEach(c => { porCategoria[c.id] = { ...c, gastos: [], total: 0 } })

    gastos.forEach(g => {
        // FIX: el join puede devolver gc_categorias como objeto o null
        const catId = g.gc_categorias?.id
        if (catId && porCategoria[catId]) {
            porCategoria[catId].gastos.push(g)
            porCategoria[catId].total += Number(g.monto)
        } else {
            // Categoría no mapeada → Otro (id 10)
            if (porCategoria[10]) {
                porCategoria[10].gastos.push(g)
                porCategoria[10].total += Number(g.monto)
            }
        }
    })

    cont.innerHTML = ''

    const conGastos = Object.values(porCategoria).filter(c => c.gastos.length > 0)
    const sinGastos = Object.values(porCategoria).filter(c => c.gastos.length === 0)

    ;[...conGastos, ...sinGastos].forEach(cat => {
        const item = document.createElement('div')
        item.className = 'acord-item' + (cat.gastos.length > 0 ? ' abierto' : '')
        item.innerHTML = `
            <div class="acord-header" onclick="toggleAcord(this)">
                <div class="acord-izq">
                    <span class="acord-icono">${cat.icono}</span>
                    <span class="acord-nombre">${cat.nombre}</span>
                </div>
                <div class="acord-der">
                    <span class="acord-total">${cat.total > 0 ? formatPesos(cat.total) : '$0'}</span>
                    <span class="acord-flecha">▼</span>
                </div>
            </div>
            <div class="acord-body">
                ${cat.gastos.length === 0
                    ? '<p class="sin-gastos">Sin gastos este mes</p>'
                    : cat.gastos.map(g => `
                        <div class="gasto-fila">
                            <div class="gasto-izq">
                                <div class="gasto-quien ${g.gc_usuarios?.nombre === 'Esposo' ? 'esposo' : 'esposa'}">
                                    ${g.gc_usuarios?.nombre === 'Esposo' ? '👨' : '👩'} ${g.gc_usuarios?.nombre || '?'}
                                </div>
                                <div class="gasto-desc">${g.descripcion}</div>
                                <div class="gasto-fecha">${formatFecha(g.fecha)}</div>
                            </div>
                            <div class="gasto-der">
                                <div class="gasto-monto">${formatPesos(g.monto)}</div>
                                ${g.gc_usuarios?.nombre === usuario.nombre
                                    ? `<button class="btn-eliminar" onclick="eliminarGasto('${g.id}')">🗑</button>`
                                    : ''}
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `
        cont.appendChild(item)
    })
}

function toggleAcord(header) {
    header.parentElement.classList.toggle('abierto')
}

function formatFecha(fechaStr) {
    // FIX: forzar mediodía para evitar desfase de zona horaria
    const f = new Date(fechaStr + 'T12:00:00')
    return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

async function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error } = await db.from('gc_gastos').delete().eq('id', id)
    if (error) {
        mostrarToast('Error eliminando: ' + error.message, 'error')
    } else {
        mostrarToast('🗑 Gasto eliminado')
        cargarGastos()
    }
}

function cambiarMes(dir) {
    mesActual += dir
    if (mesActual > 12) { mesActual = 1;  anioActual++ }
    if (mesActual < 1)  { mesActual = 12; anioActual-- }
    const url = new URL(window.location)
    url.searchParams.set('mes', mesActual)
    url.searchParams.set('anio', anioActual)
    window.history.replaceState({}, '', url)
    cargarGastos()
}

cargarGastos()

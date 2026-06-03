// ============================================
// GASTOS COMPARTIDOS — Historial script.js
// FIX: query correcto, join gc_usuarios, agrupación
// ============================================

const usuario = requireUsuario()

document.getElementById('txt-usuario').textContent =
    (usuario.nombre === 'Esposo' ? '👨' : '👩') + ' ' + usuario.nombre

async function cargarHistorial() {
    const cont = document.getElementById('historial-contenedor')
    cont.innerHTML = '<div class="spinner"></div>'

    // FIX: select con join explícito
    const { data: todos, error } = await db
        .from('gc_gastos')
        .select('id, monto, fecha, usuario_id, gc_usuarios(nombre)')
        .order('fecha', { ascending: false })

    if (error) {
        cont.innerHTML = `<p style="color:#E74C3C;text-align:center;padding:2em">
            Error cargando historial:<br>${error.message}
        </p>`
        console.error('Historial error:', error)
        return
    }

    if (!todos || todos.length === 0) {
        cont.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:2em">Sin gastos registrados aún</p>'
        return
    }

    // Necesitamos los IDs de esposo/esposa para separar montos
    const { data: usuarios } = await db.from('gc_usuarios').select('*')
    const esposo = usuarios?.find(u => u.nombre === 'Esposo')
    const esposa = usuarios?.find(u => u.nombre === 'Esposa')

    // Agrupa por mes/año
    const porMes = {}
    todos.forEach(g => {
        // FIX: T12:00:00 para evitar desfase de zona horaria
        const fecha = new Date(g.fecha + 'T12:00:00')
        const key   = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2,'0')}`
        if (!porMes[key]) porMes[key] = { gastos: [], esposo: 0, esposa: 0 }
        porMes[key].gastos.push(g)

        // FIX: compara por usuario_id con id real, no por nombre del join
        if (esposo && g.usuario_id === esposo.id) {
            porMes[key].esposo += Number(g.monto)
        } else if (esposa && g.usuario_id === esposa.id) {
            porMes[key].esposa += Number(g.monto)
        } else {
            // fallback: usar el nombre del join si está disponible
            const nombre = g.gc_usuarios?.nombre
            if (nombre === 'Esposo')      porMes[key].esposo += Number(g.monto)
            else if (nombre === 'Esposa') porMes[key].esposa += Number(g.monto)
        }
    })

    cont.innerHTML = ''

    Object.keys(porMes).sort().reverse().forEach(key => {
        const [a, m]    = key.split('-')
        const fecha     = new Date(parseInt(a), parseInt(m) - 1, 1)
        const mesNombre = fecha.toLocaleString('es-CO', { month: 'long', year: 'numeric' })
        const data      = porMes[key]
        const diff      = Math.abs(data.esposo - data.esposa)
        const total     = data.esposo + data.esposa

        let deudaTxt = ''
        if (diff < 1000) {
            deudaTxt = `✅ Quedaron a mano — ${formatPesos(total)} total`
        } else if (data.esposo > data.esposa) {
            deudaTxt = `👩 Mary debía ${formatPesos(diff / 2)} a Carlos`
        } else {
            deudaTxt = `👨 Carlos debía ${formatPesos(diff / 2)} a Mary`
        }

        const card = document.createElement('div')
        card.className = 'mes-card'
        card.innerHTML = `
            <div class="mes-card-header">
                <div class="mes-card-titulo">
                    ${mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)}
                </div>
                <div class="mes-totales">
                    <div class="mes-total-item">
                        <div class="mes-total-quien">👨 Esposo</div>
                        <div class="mes-total-monto esposo">${formatPesos(data.esposo)}</div>
                    </div>
                    <div class="mes-total-item">
                        <div class="mes-total-quien">👩 Esposa</div>
                        <div class="mes-total-monto esposa">${formatPesos(data.esposa)}</div>
                    </div>
                    <div class="mes-total-item">
                        <div class="mes-total-quien">📦 Total</div>
                        <div class="mes-total-monto total">${formatPesos(total)}</div>
                    </div>
                </div>
            </div>
            <div class="mes-deuda">${deudaTxt}</div>
            <button class="btn-ver-mes"
                onclick="window.location.href='/gastos-compartidos/gastos/?mes=${m}&anio=${a}'">
                Ver detalle →
            </button>
        `
        cont.appendChild(card)
    })
}

cargarHistorial()

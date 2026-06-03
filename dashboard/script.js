// ============================================
// GASTOS COMPARTIDOS — Dashboard script.js
// FIXES: rangoMes(), saldo anterior, deuda correcta
// ============================================

const usuario = requireUsuario()
let mesActual  = new Date().getMonth() + 1
let anioActual = new Date().getFullYear()
let graficaLinea, graficaTortaEsposo, graficaTortaEsposa, graficaBarras

document.getElementById('txt-usuario').textContent =
    (usuario.nombre === 'Esposo' ? '👨' : '👩') + ' ' + usuario.nombre

async function cargarDashboard() {
    // Nombre del mes
    const mesNombre = new Date(anioActual, mesActual - 1, 1)
        .toLocaleString('es-CO', { month: 'long', year: 'numeric' })
    document.getElementById('txt-mes').textContent =
        mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1)

    // FIX: usar rangoMes() en vez de hardcodear -31
    const { inicio, fin } = rangoMes(anioActual, mesActual)

    // Cargar usuarios una sola vez
    const { data: usuarios, error: errU } = await db.from('gc_usuarios').select('*')
    if (errU) { console.error('Error usuarios:', errU); return }

    const esposo = usuarios.find(u => u.nombre === 'Esposo')
    const esposa = usuarios.find(u => u.nombre === 'Esposa')

    if (!esposo || !esposa) {
        console.error('No se encontraron los usuarios en gc_usuarios')
        mostrarToast('Error: usuarios no encontrados en la BD', 'error')
        return
    }

    // Gastos mes actual
    const { data: gastos, error } = await db
        .from('gc_gastos')
        .select('*, gc_usuarios(nombre), gc_categorias(nombre, icono)')
        .gte('fecha', inicio)
        .lte('fecha', fin)

    if (error) { console.error('Error gastos:', error); return }

    const gastosEsposo = gastos.filter(g => g.usuario_id === esposo.id)
    const gastosEsposa = gastos.filter(g => g.usuario_id === esposa.id)
    const totalEsposo  = gastosEsposo.reduce((s, g) => s + Number(g.monto), 0)
    const totalEsposa  = gastosEsposa.reduce((s, g) => s + Number(g.monto), 0)
    const totalGeneral = totalEsposo + totalEsposa

    document.getElementById('total-esposo').textContent = formatPesos(totalEsposo)
    document.getElementById('total-esposa').textContent = formatPesos(totalEsposa)

    // ── Saldo mes anterior ──────────────────────
    const mesPrev = mesActual === 1 ? 12 : mesActual - 1
    const anioPrev = mesActual === 1 ? anioActual - 1 : anioActual
    const { inicio: iPrev, fin: fPrev } = rangoMes(anioPrev, mesPrev)

    const { data: gastosPrev } = await db
        .from('gc_gastos')
        .select('usuario_id, monto')
        .gte('fecha', iPrev)
        .lte('fecha', fPrev)

    const prevEsposo = (gastosPrev || [])
        .filter(g => g.usuario_id === esposo.id)
        .reduce((s, g) => s + Number(g.monto), 0)
    const prevEsposa = (gastosPrev || [])
        .filter(g => g.usuario_id === esposa.id)
        .reduce((s, g) => s + Number(g.monto), 0)
    const diffPrev = Math.abs(prevEsposo - prevEsposa)

    const txtSaldo = document.getElementById('saldo-anterior-texto')
    if (!gastosPrev || gastosPrev.length === 0) {
        txtSaldo.textContent = 'Sin gastos en el mes anterior'
    } else if (diffPrev < 1000) {
        txtSaldo.textContent = `✅ Quedaron a mano — ${formatPesos(prevEsposo + prevEsposa)} total`
    } else if (prevEsposo > prevEsposa) {
        // Esposo gastó más → esposa le debe la diferencia para equilibrar
        txtSaldo.innerHTML = `👩 Mary quedó debiendo <strong>${formatPesos(diffPrev / 2)}</strong> a Carlos`
    } else {
        txtSaldo.innerHTML = `👨 Carlos quedó debiendo <strong>${formatPesos(diffPrev / 2)}</strong> a Mary`
    }

    // ── Balance mes actual ──────────────────────
    // FIX: la lógica correcta de quien debe a quien:
    // Si el esposo gastó más, él puso más dinero → la esposa le debe la mitad de la diferencia
    const diff = Math.abs(totalEsposo - totalEsposa)
    const deudaEl = document.getElementById('deuda-texto')
    if (totalGeneral === 0) {
        deudaEl.textContent = 'Sin gastos este mes'
    } else if (diff < 1000) {
        deudaEl.textContent = '✅ Están a mano este mes'
    } else if (totalEsposo > totalEsposa) {
        deudaEl.innerHTML = `👩 Mary le debe <strong>${formatPesos(diff / 2)}</strong> a Carlos`
    } else {
        deudaEl.innerHTML = `👨 Carlos le debe <strong>${formatPesos(diff / 2)}</strong> a Mary`
    }

    // ── Barras ──────────────────────────────────
    const pctE = totalGeneral > 0 ? Math.round((totalEsposo / totalGeneral) * 100) : 0
    const pctM = 100 - pctE
    document.getElementById('barra-esposo').style.width = pctE + '%'
    document.getElementById('barra-esposa').style.width = pctM + '%'
    document.getElementById('pct-esposo').textContent = pctE + '%'
    document.getElementById('pct-esposa').textContent = pctM + '%'

    // ── Agrupación por categoría ─────────────────
    const catEsposo = {}
    const catEsposa = {}
    CATEGORIAS.forEach(c => { catEsposo[c.nombre] = 0; catEsposa[c.nombre] = 0 })

    gastosEsposo.forEach(g => {
        const cat = g.gc_categorias?.nombre || 'Otro'
        catEsposo[cat] = (catEsposo[cat] || 0) + Number(g.monto)
    })
    gastosEsposa.forEach(g => {
        const cat = g.gc_categorias?.nombre || 'Otro'
        catEsposa[cat] = (catEsposa[cat] || 0) + Number(g.monto)
    })

    const labels        = CATEGORIAS.map(c => c.icono + ' ' + c.nombre)
    const valoresEsposo = CATEGORIAS.map(c => catEsposo[c.nombre] || 0)
    const valoresEsposa = CATEGORIAS.map(c => catEsposa[c.nombre] || 0)

    const colores = [
        '#FF6384','#36A2EB','#FFCE56','#4BC0C0',
        '#9966FF','#FF9F40','#C9CBCF','#7CFC00','#FF4444','#00BFFF'
    ]

    // Torta esposo
    if (graficaTortaEsposo) graficaTortaEsposo.destroy()
    graficaTortaEsposo = new Chart(document.getElementById('grafica-torta-esposo'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: valoresEsposo, backgroundColor: colores, borderColor: '#16213e', borderWidth: 2 }]
        },
        options: { plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } } } }
    })

    // Torta esposa
    if (graficaTortaEsposa) graficaTortaEsposa.destroy()
    graficaTortaEsposa = new Chart(document.getElementById('grafica-torta-esposa'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: valoresEsposa, backgroundColor: colores, borderColor: '#16213e', borderWidth: 2 }]
        },
        options: { plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } } } }
    })

    // Barras por categoría
    if (graficaBarras) graficaBarras.destroy()
    graficaBarras = new Chart(document.getElementById('grafica-barras'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: '👨 Esposo', data: valoresEsposo, backgroundColor: 'rgba(74,144,217,0.8)', borderColor: '#4A90D9', borderWidth: 1 },
                { label: '👩 Esposa', data: valoresEsposa, backgroundColor: 'rgba(231,76,60,0.8)',  borderColor: '#E74C3C', borderWidth: 1 }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: 'rgba(255,255,255,0.6)', callback: v => '$' + v.toLocaleString('es-CO') }, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            plugins: { legend: { labels: { color: 'rgba(255,255,255,0.8)' } } }
        }
    })

    await cargarGraficaLinea(esposo.id, esposa.id)
}

async function cargarGraficaLinea(esposoId, esposaId) {
    const meses = [], totalesEsposo = [], totalesEsposa = []

    for (let i = 5; i >= 0; i--) {
        const fecha = new Date(anioActual, mesActual - 1 - i, 1)
        const m = fecha.getMonth() + 1
        const a = fecha.getFullYear()
        const { inicio, fin } = rangoMes(a, m)  // FIX: rangoMes en lugar de -31

        meses.push(fecha.toLocaleString('es-CO', { month: 'short' }))

        const { data } = await db
            .from('gc_gastos')
            .select('usuario_id, monto')
            .gte('fecha', inicio)
            .lte('fecha', fin)

        const te = (data || []).filter(g => g.usuario_id === esposoId).reduce((s, g) => s + Number(g.monto), 0)
        const tm = (data || []).filter(g => g.usuario_id === esposaId).reduce((s, g) => s + Number(g.monto), 0)
        totalesEsposo.push(te)
        totalesEsposa.push(tm)
    }

    if (graficaLinea) graficaLinea.destroy()
    graficaLinea = new Chart(document.getElementById('grafica-linea'), {
        type: 'line',
        data: {
            labels: meses,
            datasets: [
                { label: '👨 Esposo', data: totalesEsposo, borderColor: '#4A90D9', backgroundColor: 'rgba(74,144,217,0.15)', tension: 0.4, fill: true, pointBackgroundColor: '#4A90D9' },
                { label: '👩 Esposa', data: totalesEsposa, borderColor: '#E74C3C', backgroundColor: 'rgba(231,76,60,0.15)',  tension: 0.4, fill: true, pointBackgroundColor: '#E74C3C' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { ticks: { color: 'rgba(255,255,255,0.6)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: 'rgba(255,255,255,0.6)', callback: v => '$' + v.toLocaleString('es-CO') }, grid: { color: 'rgba(255,255,255,0.05)' } }
            },
            plugins: { legend: { labels: { color: 'rgba(255,255,255,0.8)' } } }
        }
    })
}

function cambiarMes(dir) {
    mesActual += dir
    if (mesActual > 12) { mesActual = 1; anioActual++ }
    if (mesActual < 1)  { mesActual = 12; anioActual-- }
    cargarDashboard()
}

async function handleReset() {
    const ok = await resetearTodosLosGastos()
    if (ok) cargarDashboard()
}

cargarDashboard()

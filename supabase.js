// ============================================
// GASTOS COMPARTIDOS — Carlos & Mary
// supabase.js — conexión global + utilidades
// ============================================
const SUPABASE_URL = 'https://jvwltijauojexuswuurf.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d2x0aWphdW9qZXh1c3d1dXJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTc4MjAsImV4cCI6MjA5NTQ3MzgyMH0.FSzCXTfJEQB2rw1H1T8ONkLALwfS6qZ9NxQhXUATR0E'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Sesión ──────────────────────────────────
function getUsuario() {
    return JSON.parse(sessionStorage.getItem('gc_usuario') || 'null')
}
function setUsuario(usuario) {
    sessionStorage.setItem('gc_usuario', JSON.stringify(usuario))
}
function requireUsuario() {
    const u = getUsuario()
    if (!u) window.location.href = '/gastos-compartidos/'
    return u
}

// ── Formato ─────────────────────────────────
function formatPesos(monto) {
    return '$' + Number(monto).toLocaleString('es-CO')
}

// ── Fechas: rango correcto del mes ───────────
// FIX: "-31" falla en febrero, abril, junio, etc.
function rangoMes(anio, mes) {
    const inicio = `${anio}-${String(mes).padStart(2,'0')}-01`
    const ultimo = new Date(anio, mes, 0).getDate()
    const fin    = `${anio}-${String(mes).padStart(2,'0')}-${String(ultimo).padStart(2,'0')}`
    return { inicio, fin }
}

// ── Toast ────────────────────────────────────
function mostrarToast(msg, tipo = 'ok') {
    let t = document.getElementById('toast')
    if (!t) {
        t = document.createElement('div')
        t.id = 'toast'
        t.className = 'toast'
        document.body.appendChild(t)
    }
    t.textContent = msg
    t.className = 'toast' + (tipo === 'error' ? ' error' : '')
    setTimeout(() => t.classList.add('show'), 10)
    setTimeout(() => t.classList.remove('show'), 2800)
}

// ── Categorías ───────────────────────────────
const CATEGORIAS = [
    { id: 1,  nombre: 'Comida',             icono: '🍽' },
    { id: 2,  nombre: 'Arriendo',           icono: '🏠' },
    { id: 3,  nombre: 'Servicios públicos', icono: '💡' },
    { id: 4,  nombre: 'Internet / Celular', icono: '📱' },
    { id: 5,  nombre: 'Transporte',         icono: '🚗' },
    { id: 6,  nombre: 'Salud / Farmacia',   icono: '💊' },
    { id: 7,  nombre: 'Ropa',               icono: '👟' },
    { id: 8,  nombre: 'Ahorro',             icono: '🐷' },
    { id: 9,  nombre: 'Imprevistos',        icono: '🚨' },
    { id: 10, nombre: 'Otro',               icono: '📦' },
]

// ── Reset total ──────────────────────────────
async function resetearTodosLosGastos() {
    const confirmacion = prompt(
        '⚠️ Esto borrará TODOS los gastos permanentemente.\n\nEscribe BORRAR para confirmar:'
    )
    if (confirmacion !== 'BORRAR') {
        mostrarToast('Cancelado', 'error')
        return false
    }
    try {
        const { error } = await db
            .from('gc_gastos')
            .delete()
            .gte('id', '00000000-0000-0000-0000-000000000000')
        if (error) throw error
        mostrarToast('✅ Todos los gastos eliminados')
        return true
    } catch (err) {
        console.error(err)
        mostrarToast('Error al resetear: ' + err.message, 'error')
        return false
    }
}

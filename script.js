// ============================================
// GASTOS COMPARTIDOS — Carlos Monettrosa
// script.js — Login / selección de usuario
// ============================================

async function seleccionarUsuario(tipo) {
    const btn = document.getElementById('btn-' + tipo)
    btn.style.opacity = '0.6'
    btn.style.pointerEvents = 'none'

    try {
        // Busca el usuario en Supabase según el nombre
        const nombre = tipo === 'esposo' ? 'Esposo' : 'Esposa'
        const { data, error } = await db
            .from('gc_usuarios')
            .select('*')
            .eq('nombre', nombre)
            .single()

        if (error) throw error

        // Guarda en sessionStorage y redirige al dashboard
        setUsuario(data)
        window.location.href = '/gastos-compartidos/dashboard/'

    } catch (err) {
        console.error(err)
        mostrarToast('Error conectando con Supabase', 'error')
        btn.style.opacity = '1'
        btn.style.pointerEvents = 'auto'
    }
}

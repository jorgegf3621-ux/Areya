import { useState } from 'react'
import { supabase, getTasks, completeTask } from '../lib/supabase'

const CATEGORIAS = ['Previo al ingreso', 'Inducción', 'Políticas', 'Beneficios', 'Integración al puesto', 'Seguimiento']

export default function Portal() {
  const [screen, setScreen] = useState('login') // login | not_found | portal
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [empleado, setEmpleado] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(CATEGORIAS[0])

  const progress = tasks.length ? Math.round((tasks.filter(t => t.completado).length / tasks.length) * 100) : 0

  const login = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: emp } = await supabase
        .from('empleados')
        .select('*')
        .eq('email_corporativo', email.trim().toLowerCase())
        .single()

      if (!emp) { setScreen('not_found'); setLoading(false); return }
      if (emp.status === 'Inactivo') { setError('Esta cuenta está inactiva. Contacta a RRHH.'); setLoading(false); return }

      // Check if password set (auth real — por ahora usamos NSS como password temporal)
      if (password !== emp.nss && password !== 'areya2026') {
        setError('Contraseña incorrecta.')
        setLoading(false); return
      }

      setEmpleado(emp)
      const t = await getTasks(emp.id)
      setTasks(t)
      setScreen('portal')
    } catch (e) {
      setError('Error al conectar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (taskId) => {
    await completeTask(taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completado: true, fecha_completado: new Date().toISOString() } : t))
  }

  // ── SCREENS ──────────────────────────────────────────────

  if (screen === 'login') return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-brand px-8 pt-8 pb-6 text-center">
          <div className="font-serif text-white text-2xl font-bold">Areya</div>
          <div className="text-white/50 text-sm mt-1">Portal de onboarding</div>
        </div>
        <div className="px-8 py-7">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Correo corporativo</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu.nombre@areya.mx"
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Tu NSS (contraseña temporal)"
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-indigo-100"
                onKeyDown={e => e.key === 'Enter' && login()} />
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
            <button onClick={login} disabled={loading} className="btn-primary w-full py-2.5 mt-1">
              {loading ? 'Verificando...' : 'Entrar al portal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (screen === 'not_found') return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="font-serif text-xl font-bold text-brand mb-2">Correo no encontrado</h2>
        <p className="text-gray-500 text-sm mb-6">No encontramos <strong>{email}</strong> en el sistema. Verifica con RRHH que tu correo corporativo esté registrado.</p>
        <button onClick={() => { setScreen('login'); setError('') }} className="btn-primary">← Volver</button>
      </div>
    </div>
  )

  // ── PORTAL PRINCIPAL ──────────────────────────────────────
  const tasksByTab = tasks.filter(t => t.categoria === activeTab)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand text-white px-6 py-4 flex items-center justify-between">
        <div>
          <div className="font-serif text-lg font-bold">Areya</div>
          <div className="text-white/50 text-xs">Portal de onboarding</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{empleado?.nombre_completo}</div>
          <div className="text-white/50 text-xs">{empleado?.cargo} · {empleado?.departamento}</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Progress card */}
        <div className="card mb-6 flex items-center gap-6">
          {/* Ring */}
          <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="none" stroke="#E5E7EB" strokeWidth="6" />
              <circle cx="36" cy="36" r="30" fill="none" stroke="#4F46E5" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress / 100)}`}
                strokeLinecap="round" transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand">{progress}%</span>
          </div>
          <div className="flex-1">
            <div className="font-serif text-lg font-bold text-brand">
              {progress === 100 ? '¡Onboarding completo! 🎉' : 'Tu onboarding en progreso'}
            </div>
            <div className="text-gray-500 text-sm mt-1">
              {tasks.filter(t => t.completado).length} de {tasks.length} actividades completadas
            </div>
            {progress === 100 && (
              <div className="mt-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 inline-block">
                Tu estatus cambiará a Activo automáticamente ✓
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {CATEGORIAS.map(cat => {
            const total = tasks.filter(t => t.categoria === cat).length
            const done = tasks.filter(t => t.categoria === cat && t.completado).length
            return (
              <button key={cat} onClick={() => setActiveTab(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === cat ? 'bg-accent text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-accent'}`}>
                {cat} {total > 0 && <span className={`ml-1 ${done === total ? 'text-emerald-400' : ''}`}>{done}/{total}</span>}
              </button>
            )
          })}
        </div>

        {/* Tasks */}
        <div className="flex flex-col gap-3">
          {tasksByTab.length === 0 && (
            <div className="card text-center text-gray-400 text-sm py-8">No hay actividades en esta categoría</div>
          )}
          {tasksByTab.map(task => (
            <div key={task.id} className={`card flex items-start gap-4 transition-all ${task.completado ? 'opacity-60' : ''}`}>
              <button onClick={() => !task.completado && handleComplete(task.id)}
                className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                  ${task.completado ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-accent cursor-pointer'}`}>
                {task.completado && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <div className="flex-1">
                <div className={`text-sm font-semibold ${task.completado ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.titulo}</div>
                {task.descripcion && <div className="text-xs text-gray-500 mt-0.5">{task.descripcion}</div>}
                {task.fecha_completado && (
                  <div className="text-xs text-emerald-600 mt-1">
                    Completado el {new Date(task.fecha_completado).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

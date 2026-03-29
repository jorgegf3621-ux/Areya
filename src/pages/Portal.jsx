import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { completeTask, getTasks, markEmpleadoActivoSiOnboardingCompleto } from '../lib/supabase'

const CATEGORIAS = ['Previo al ingreso', 'Inducción', 'Políticas', 'Beneficios', 'Integración al puesto', 'Seguimiento']

async function portalAuth(action, payload = {}) {
  const res = await fetch('/api/portal-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(data.error || 'server_error')
    error.code = data.error || 'server_error'
    throw error
  }

  return data
}

export default function Portal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [screen, setScreen] = useState('email') // email | create_password | login | forgot | reset_password | invalid | token_error | portal
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [empleado, setEmpleado] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState(CATEGORIAS[0])

  const activationToken = searchParams.get('token')
  const resetToken = searchParams.get('reset')
  const progress = tasks.length ? Math.round((tasks.filter(t => t.completado).length / tasks.length) * 100) : 0

  useEffect(() => {
    const loadToken = async () => {
      if (!activationToken && !resetToken) return
      setLoading(true)
      setError('')
      setMessage('')
      try {
        if (activationToken) {
          const result = await portalAuth('lookup_activation', { token: activationToken })
          setEmail(result.access.email_corporativo || '')
          setEmpleado(result.empleado)
          setScreen(result.next)
          return
        }

        if (resetToken) {
          const result = await portalAuth('lookup_reset', { token: resetToken })
          setEmail(result.access.email_corporativo || '')
          setEmpleado(result.empleado)
          setScreen('reset_password')
        }
      } catch (e) {
        setScreen('token_error')
      } finally {
        setLoading(false)
      }
    }

    loadToken()
  }, [activationToken, resetToken])

  const enterPortal = async (emp) => {
    const t = await getTasks(emp.id)
    setEmpleado(emp)
    setTasks(t)
    setActiveTab(CATEGORIAS[0])
    setScreen('portal')
    if (t.length && t.every(task => task.completado)) {
      await markEmpleadoActivoSiOnboardingCompleto(emp.id)
      setEmpleado(prev => prev ? { ...prev, status: 'Activo' } : emp)
    }
  }

  const submitEmail = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = await portalAuth('lookup_email', { email })
      setEmail(result.access.email_corporativo || email.trim().toLowerCase())
      setEmpleado(result.empleado)
      setScreen(result.next)
    } catch (e) {
      if (e.code === 'invalid_email') setScreen('invalid')
      else if (e.code === 'inactive') setError('Esta cuenta está inactiva. Contacta a RRHH.')
      else setError('Error al verificar tu correo. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const submitCreatePassword = async () => {
    if (password.length < 8) {
      setError('Tu contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await portalAuth('set_password', { token: activationToken, password })
      setSearchParams({})
      await enterPortal(empleado)
    } catch (e) {
      setError(e.code === 'expired_token' ? 'Tu enlace de activación expiró. Solicita uno nuevo a RRHH.' : 'No fue posible crear tu contraseña.')
    } finally {
      setLoading(false)
    }
  }

  const submitLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await portalAuth('login', { email, password })
      setSearchParams({})
      await enterPortal(result.empleado)
    } catch (e) {
      if (e.code === 'invalid_email') setScreen('invalid')
      else if (e.code === 'password_not_set') setError('Tu cuenta aún no tiene contraseña. Usa tu enlace de activación.')
      else if (e.code === 'inactive') setError('Esta cuenta está inactiva. Contacta a RRHH.')
      else if (e.code === 'invalid_password') setError('Contraseña incorrecta.')
      else setError('Error al iniciar sesión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const submitForgot = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await portalAuth('request_reset', { email })
      setMessage('Te enviamos un enlace para restablecer tu contraseña.')
    } catch (e) {
      setError(e.code === 'invalid_email' ? 'No encontramos ese correo en el portal.' : 'No fue posible enviar el enlace de recuperación.')
    } finally {
      setLoading(false)
    }
  }

  const submitResetPassword = async () => {
    if (password.length < 8) {
      setError('Tu contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await portalAuth('reset_password', { token: resetToken, password })
      setSearchParams({})
      setScreen('login')
      setPassword('')
      setConfirmPassword('')
      setMessage('Tu contraseña se actualizó. Ya puedes iniciar sesión.')
    } catch (e) {
      setError(e.code === 'expired_token' ? 'Tu enlace de recuperación expiró.' : 'No fue posible actualizar tu contraseña.')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (taskId) => {
    await completeTask(taskId)
    const nextTasks = tasks.map(t => t.id === taskId ? { ...t, completado: true, fecha_completado: new Date().toISOString() } : t)
    setTasks(nextTasks)
    if (nextTasks.length && nextTasks.every(task => task.completado)) {
      await markEmpleadoActivoSiOnboardingCompleto(empleado.id)
      setEmpleado(prev => prev ? { ...prev, status: 'Activo' } : prev)
    }
  }

  const resetToEmail = () => {
    setScreen('email')
    setPassword('')
    setConfirmPassword('')
    setError('')
    setMessage('')
    setSearchParams({})
  }

  if (screen === 'email') return (
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
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu.nombre@areya.com.mx"
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-indigo-100"
                onKeyDown={e => e.key === 'Enter' && submitEmail()}
              />
            </div>
            <div className="text-xs text-gray-400 leading-relaxed">
              Primero validaremos tu correo. Si es tu primer acceso, te pediremos crear tu contraseña.
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
            {message && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">{message}</div>}
            <button onClick={submitEmail} disabled={loading || !email.trim()} className="btn-primary w-full py-2.5 mt-1 disabled:opacity-60">
              {loading ? 'Verificando...' : 'Continuar →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  if (screen === 'create_password' || screen === 'reset_password') return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-brand px-8 pt-8 pb-6 text-center">
          <div className="font-serif text-white text-2xl font-bold">{screen === 'create_password' ? 'Activa tu acceso' : 'Restablece tu contraseña'}</div>
          <div className="text-white/50 text-sm mt-1">{email}</div>
        </div>
        <div className="px-8 py-7 flex flex-col gap-4">
          <div className="text-sm text-gray-500 leading-relaxed">
            {screen === 'create_password'
              ? 'Este es tu primer acceso al portal. Crea una contraseña para continuar con tu onboarding.'
              : 'Crea una nueva contraseña para recuperar tu acceso al portal.'}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-indigo-100"
              onKeyDown={e => e.key === 'Enter' && (screen === 'create_password' ? submitCreatePassword() : submitResetPassword())}
            />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
          <button
            onClick={screen === 'create_password' ? submitCreatePassword : submitResetPassword}
            disabled={loading || !password || !confirmPassword}
            className="btn-primary w-full py-2.5 disabled:opacity-60"
          >
            {loading ? 'Guardando...' : screen === 'create_password' ? 'Crear contraseña y entrar' : 'Actualizar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )

  if (screen === 'login') return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-brand px-8 pt-8 pb-6 text-center">
          <div className="font-serif text-white text-2xl font-bold">Areya</div>
          <div className="text-white/50 text-sm mt-1">Portal de onboarding</div>
        </div>
        <div className="px-8 py-7 flex flex-col gap-4">
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-700 font-mono">{email}</div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-indigo-100"
              onKeyDown={e => e.key === 'Enter' && submitLogin()}
            />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
          {message && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">{message}</div>}
          <button onClick={submitLogin} disabled={loading || !password} className="btn-primary w-full py-2.5 disabled:opacity-60">
            {loading ? 'Entrando...' : 'Entrar al portal'}
          </button>
          <button onClick={() => { setScreen('forgot'); setError(''); setMessage('') }} className="text-xs text-gray-500 hover:text-gray-700">
            {'Olvid\u00e9 contrase\u00f1a'}
          </button>
          <button onClick={resetToEmail} className="text-xs text-gray-500 hover:text-gray-700">
            Usar otro correo
          </button>
        </div>
      </div>
    </div>
  )

  if (screen === 'forgot') return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-brand px-8 pt-8 pb-6 text-center">
          <div className="font-serif text-white text-2xl font-bold">Recuperar acceso</div>
          <div className="text-white/50 text-sm mt-1">Portal de onboarding</div>
        </div>
        <div className="px-8 py-7 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Correo corporativo</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-indigo-100"
              onKeyDown={e => e.key === 'Enter' && submitForgot()}
            />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
          {message && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">{message}</div>}
          <button onClick={submitForgot} disabled={loading || !email.trim()} className="btn-primary w-full py-2.5 disabled:opacity-60">
            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
          <button onClick={() => { setScreen('login'); setError(''); setMessage('') }} className="text-xs text-gray-500 hover:text-gray-700">
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    </div>
  )

  if (screen === 'invalid' || screen === 'token_error') return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">{screen === 'invalid' ? '🔍' : '⏳'}</div>
        <h2 className="font-serif text-xl font-bold text-brand mb-2">
          {screen === 'invalid' ? 'Correo no válido' : 'Enlace no disponible'}
        </h2>
        <p className="text-gray-500 text-sm mb-6">
          {screen === 'invalid'
            ? `No encontramos ${email} con acceso al portal. Verifica con RRHH que tu onboarding ya esté configurado.`
            : 'Este enlace ya expiró o no es válido. Solicita a RRHH que te reenvíe tu acceso o genera uno nuevo de recuperación.'}
        </p>
        <button onClick={resetToEmail} className="btn-primary">← Volver</button>
      </div>
    </div>
  )

  const tasksByTab = tasks.filter(t => t.categoria === activeTab)

  return (
    <div className="min-h-screen bg-gray-50">
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
        <div className="card mb-6 flex items-center gap-6">
          <div className="relative flex-shrink-0" style={{ width: 72, height: 72 }}>
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="none" stroke="#E5E7EB" strokeWidth="6" />
              <circle
                cx="36"
                cy="36"
                r="30"
                fill="none"
                stroke="#4F46E5"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 30}`}
                strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand">{progress}%</span>
          </div>
          <div className="flex-1">
            <div className="font-serif text-lg font-bold text-brand">
              {progress === 100 ? '¡Onboarding completo!' : 'Tu onboarding en progreso'}
            </div>
            <div className="text-gray-500 text-sm mt-1">
              {tasks.filter(t => t.completado).length} de {tasks.length} actividades completadas
            </div>
            {progress === 100 && (
              <div className="mt-2 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg px-3 py-1.5 inline-block">
                Tu estatus ya quedó actualizado a Activo ✓
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {CATEGORIAS.map(cat => {
            const total = tasks.filter(t => t.categoria === cat).length
            const done = tasks.filter(t => t.categoria === cat && t.completado).length
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === cat ? 'bg-accent text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-accent'}`}
              >
                {cat} {total > 0 && <span className={`ml-1 ${done === total ? 'text-emerald-400' : ''}`}>{done}/{total}</span>}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3">
          {tasksByTab.length === 0 && (
            <div className="card text-center text-gray-400 text-sm py-8">No hay actividades en esta categoría</div>
          )}
          {tasksByTab.map(task => (
            <div key={task.id} className={`card flex items-start gap-4 transition-all ${task.completado ? 'opacity-60' : ''}`}>
              <button
                onClick={() => !task.completado && handleComplete(task.id)}
                className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                  ${task.completado ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-accent cursor-pointer'}`}
              >
                {task.completado && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
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

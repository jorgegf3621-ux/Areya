import { useState } from 'react'
import { supabase, insertEntrevistaSalida } from '../lib/supabase'

const MOTIVOS = ['Mejor oferta económica', 'Crecimiento profesional', 'Cambio de ciudad', 'Motivos personales', 'Ambiente laboral', 'Relación con jefe', 'Otro']

const STEPS = ['Identificación', 'Motivo de salida', 'Evaluación', 'Comentarios finales']

export default function Salida() {
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [empleado, setEmpleado] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    motivo_salida: '', tiempo_empresa: '',
    descripcion_puesto: 3, relacion_jefe: 3, ambiente_trabajo: 3, comunicacion: 3, desarrollo: 3,
    recomendaria: null, regresaria: null, comentarios_libres: '',
  })

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }))

  const buscarEmpleado = async () => {
    setLoading(true); setError('')
    const { data } = await supabase.from('empleados').select('*').eq('email_corporativo', email.trim().toLowerCase()).single()
    setLoading(false)
    if (!data) { setError('No encontramos ese correo. Contacta a RRHH.'); return }
    if (data.status === 'Inactivo') { setError('Este colaborador ya fue dado de baja.'); return }
    setEmpleado(data)
    setStep(1)
  }

  const submit = async () => {
    setLoading(true)
    try {
      await insertEntrevistaSalida(empleado.id, { ...form, completado: true })
      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'notify_rrhh_offboarding',
            data: {
              nombre: empleado.nombre_completo,
              cargo: empleado.cargo,
              departamento: empleado.departamento,
              motivo_salida: form.motivo_salida,
            },
          }),
        })
      } catch {}
      setDone(true)
    } catch (e) {
      setError('Error al enviar. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const Stars = ({ field }) => (
    <div className="flex gap-2 mt-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => set(field, n)}
          className={`w-10 h-10 rounded-lg text-sm font-bold transition-all border
            ${form[field] >= n ? 'bg-accent text-white border-accent' : 'bg-white text-gray-400 border-gray-200 hover:border-accent'}`}>
          {n}
        </button>
      ))}
      <span className="self-center text-xs text-gray-400 ml-1">
        {['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'][form[field]]}
      </span>
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-red-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🤝</div>
        <h1 className="font-serif text-2xl font-bold text-brand mb-3">Gracias, {empleado?.nombre}</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Tu entrevista de salida fue registrada. El equipo de RRHH la revisará y actualizará tu expediente.<br /><br />
          Fue un placer trabajar contigo en Areya. ¡Mucho éxito!
        </p>
      </div>
    </div>
  )

  const stepContent = [
    // Paso 0 — Identificación
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-500">Esta entrevista es confidencial y nos ayuda a mejorar como empresa. Por favor responde con honestidad.</p>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Correo corporativo</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="tu.nombre@areya.mx"
          className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-red-400"
          onKeyDown={e => e.key === 'Enter' && buscarEmpleado()} />
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>,

    // Paso 1 — Motivo
    <div className="flex flex-col gap-4">
      {empleado && <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm"><strong>{empleado.nombre_completo}</strong> · {empleado.cargo} · {empleado.departamento}</div>}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Motivo principal de salida</label>
        <select value={form.motivo_salida} onChange={e => set('motivo_salida', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-red-400 bg-white">
          <option value="">— Selecciona —</option>
          {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">¿Cuánto tiempo estuviste en Areya?</label>
        <input type="text" value={form.tiempo_empresa} onChange={e => set('tiempo_empresa', e.target.value)}
          placeholder="Ej: 2 años y 3 meses"
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-red-400" />
      </div>
    </div>,

    // Paso 2 — Evaluación
    <div className="flex flex-col gap-5">
      {[
        ['descripcion_puesto', 'Descripción del puesto vs. realidad'],
        ['relacion_jefe', 'Relación con tu jefe directo'],
        ['ambiente_trabajo', 'Ambiente de trabajo'],
        ['comunicacion', 'Comunicación interna'],
        ['desarrollo', 'Oportunidades de desarrollo'],
      ].map(([field, label]) => (
        <div key={field}>
          <div className="text-sm font-semibold text-gray-700 mb-1">{label}</div>
          <Stars field={field} />
        </div>
      ))}
    </div>,

    // Paso 3 — Comentarios
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">¿Recomendarías Areya como lugar de trabajo?</div>
          <div className="flex gap-2">
            {['Sí', 'No'].map(v => (
              <button key={v} onClick={() => set('recomendaria', v === 'Sí')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all
                  ${form.recomendaria === (v === 'Sí') && form.recomendaria !== null ? 'bg-accent text-white border-accent' : 'bg-white text-gray-600 border-gray-200 hover:border-accent'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-700 mb-2">¿Regresarías a trabajar a Areya?</div>
          <div className="flex gap-2">
            {['Sí', 'No'].map(v => (
              <button key={v} onClick={() => set('regresaria', v === 'Sí')}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all
                  ${form.regresaria === (v === 'Sí') && form.regresaria !== null ? 'bg-accent text-white border-accent' : 'bg-white text-gray-600 border-gray-200 hover:border-accent'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comentarios adicionales (opcional)</label>
        <textarea value={form.comentarios_libres} onChange={e => set('comentarios_libres', e.target.value)}
          rows={4} placeholder="¿Qué podría mejorar Areya? ¿Algo que quieras compartir?"
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-red-400 resize-none" />
      </div>
    </div>,
  ]

  return (
    <div className="min-h-screen bg-red-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        <div className="bg-red-800 px-8 pt-8 pb-6">
          <div className="font-serif text-white text-2xl font-bold mb-1">Areya</div>
          <div className="text-white/50 text-sm">Entrevista de salida</div>
          <div className="mt-5 flex gap-1.5">
            {STEPS.map((s, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-red-300' : 'bg-white/20'}`} />
            ))}
          </div>
          <div className="mt-2 text-white/60 text-xs">Paso {step + 1} de {STEPS.length} — {STEPS[step]}</div>
        </div>

        <div className="px-8 py-6">{stepContent[step]}</div>

        <div className="px-8 pb-8 flex justify-between">
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
            className="btn-ghost disabled:opacity-40">← Anterior</button>
          {step === 0
            ? <button onClick={buscarEmpleado} disabled={loading || !email}
                className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50">
                {loading ? 'Buscando...' : 'Continuar →'}
              </button>
            : step < STEPS.length - 1
              ? <button onClick={() => setStep(s => s + 1)}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all">
                  Siguiente →
                </button>
              : <button onClick={submit} disabled={loading}
                  className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all disabled:opacity-50">
                  {loading ? 'Enviando...' : 'Enviar entrevista ✓'}
                </button>
          }
        </div>
      </div>
    </div>
  )
}

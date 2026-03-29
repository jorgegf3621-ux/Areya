import { useState } from 'react'
import { supabase } from '../lib/supabase'

const STEPS = [
  'Datos personales',
  'Documentos oficiales',
  'Domicilio',
  'Familia y beneficiarios',
  'Vehículo',
  'Información del puesto',
]

const initialForm = {
  // Paso 1 - Datos personales
  nombre: '', ap_pat: '', ap_mat: '', fecha_nac: '', genero: '', estado_civil: '', nacionalidad: 'Mexicana',
  tipo_sangre: '', alergias: '', email_personal: '',
  // Paso 2 - Documentos
  rfc: '', curp: '', nss: '', infonavit: '',
  // Paso 3 - Domicilio
  direccion: '', municipio: '', cp: '', estado: 'Nuevo León',
  // Paso 4 - Familia
  contacto_emergencia: '', parentesco: '', tel_emergencia: '',
  // Paso 5 - Vehículo
  tiene_vehiculo: false, marca_vehiculo: '', modelo_vehiculo: '', anio_vehiculo: '', placas: '',
  // Paso 6 - Puesto
  departamento: '', cargo: '', tipo_contrato: 'Planta', jefe_directo: '', fecha_ingreso: '',
}

export default function Formulario() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const inp = (field, label, type = 'text', required = false) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={form[field]}
        onChange={e => set(field, e.target.value)}
        className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-indigo-100 transition-all"
        required={required}
      />
    </div>
  )
  const sel = (field, label, options, required = false) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={form[field]}
        onChange={e => set(field, e.target.value)}
        className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent bg-white transition-all"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  const steps = [
    // Paso 0 — Datos personales
    <div className="grid grid-cols-2 gap-4">
      {inp('nombre', 'Nombre(s)', 'text', true)}
      {inp('ap_pat', 'Apellido paterno', 'text', true)}
      {inp('ap_mat', 'Apellido materno')}
      {inp('fecha_nac', 'Fecha de nacimiento', 'date', true)}
      {sel('genero', 'Género', ['', 'Masculino', 'Femenino', 'No binario', 'Prefiero no decir'])}
      {sel('estado_civil', 'Estado civil', ['', 'Soltero/a', 'Casado/a', 'Unión libre', 'Divorciado/a', 'Viudo/a'])}
      {sel('tipo_sangre', 'Tipo de sangre', ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])}
      {inp('email_personal', 'Correo personal', 'email', true)}
      <div className="col-span-2 flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Alergias (si aplica)</label>
        <input type="text" value={form.alergias} onChange={e => set('alergias', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent" placeholder="Ninguna" />
      </div>
    </div>,

    // Paso 1 — Documentos
    <div className="grid grid-cols-2 gap-4">
      {inp('rfc', 'RFC', 'text', true)}
      {inp('curp', 'CURP', 'text', true)}
      {inp('nss', 'Número de Seguro Social (NSS)', 'text', true)}
      {inp('infonavit', 'Número Infonavit (si aplica)')}
    </div>,

    // Paso 2 — Domicilio
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Dirección <span className="text-red-500">*</span></label>
        <input type="text" value={form.direccion} onChange={e => set('direccion', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent" />
      </div>
      {inp('municipio', 'Municipio', 'text', true)}
      {inp('cp', 'Código postal')}
      {inp('estado', 'Estado')}
    </div>,

    // Paso 3 — Familia
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 text-sm font-semibold text-gray-700 mb-1">Contacto de emergencia</div>
      {inp('contacto_emergencia', 'Nombre completo', 'text', true)}
      {sel('parentesco', 'Parentesco', ['', 'Padre/Madre', 'Esposo/a', 'Hijo/a', 'Hermano/a', 'Otro'])}
      {inp('tel_emergencia', 'Teléfono', 'tel', true)}
    </div>,

    // Paso 4 — Vehículo
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2 flex items-center gap-3">
        <input type="checkbox" id="tiene_vehiculo" checked={form.tiene_vehiculo}
          onChange={e => set('tiene_vehiculo', e.target.checked)}
          className="w-4 h-4 accent-accent cursor-pointer" />
        <label htmlFor="tiene_vehiculo" className="text-sm font-medium cursor-pointer">Cuento con vehículo propio</label>
      </div>
      {form.tiene_vehiculo && <>
        {inp('marca_vehiculo', 'Marca')}
        {inp('modelo_vehiculo', 'Modelo')}
        {inp('anio_vehiculo', 'Año')}
        {inp('placas', 'Placas')}
      </>}
      {!form.tiene_vehiculo && (
        <div className="col-span-2 text-sm text-gray-400 text-center py-6">Sin vehículo — continúa al siguiente paso</div>
      )}
    </div>,

    // Paso 5 — Puesto
    <div className="grid grid-cols-2 gap-4">
      {inp('departamento', 'Área / Departamento', 'text', true)}
      {inp('cargo', 'Puesto / Cargo', 'text', true)}
      {sel('tipo_contrato', 'Tipo de contrato', ['Planta', 'Temporal', 'Practicante', 'Por proyecto'])}
      {inp('jefe_directo', 'Nombre del jefe directo', 'text', true)}
      {inp('fecha_ingreso', 'Fecha de ingreso', 'date', true)}
    </div>,
  ]

  const next = () => { if (step < STEPS.length - 1) setStep(s => s + 1) }
  const prev = () => { if (step > 0) setStep(s => s - 1) }

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.from('empleados').insert({
        ...form,
        status: 'Onboarding',
        tiene_vehiculo: form.tiene_vehiculo,
      })
      if (err) throw err
      setDone(true)
    } catch (e) {
      setError('Ocurrió un error al enviar el formulario. Por favor intenta de nuevo.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="font-serif text-2xl font-bold text-brand mb-3">¡Formulario enviado!</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          Tu información fue recibida por el equipo de RRHH de Areya.<br /><br />
          En breve recibirás un correo en <strong>{form.email_personal}</strong> con tu acceso al portal de onboarding.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-brand flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="bg-brand px-8 pt-8 pb-6">
          <div className="font-serif text-white text-2xl font-bold mb-1">Areya</div>
          <div className="text-white/50 text-sm">Formulario de ingreso · Recursos Humanos</div>
          {/* Progress */}
          <div className="mt-5 flex gap-1.5">
            {STEPS.map((s, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= step ? 'bg-indigo-400' : 'bg-white/20'}`} />
            ))}
          </div>
          <div className="mt-2 text-white/60 text-xs">Paso {step + 1} de {STEPS.length} — {STEPS[step]}</div>
        </div>

        {/* Body */}
        <div className="px-8 py-6">{steps[step]}</div>

        {/* Error */}
        {error && (
          <div className="mx-8 mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Footer */}
        <div className="px-8 pb-8 flex justify-between">
          <button onClick={prev} disabled={step === 0}
            className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed">
            ← Anterior
          </button>
          {step < STEPS.length - 1
            ? <button onClick={next} className="btn-primary">Siguiente →</button>
            : <button onClick={submit} disabled={loading} className="btn-primary disabled:opacity-60">
                {loading ? 'Enviando...' : 'Enviar formulario ✓'}
              </button>
          }
        </div>
      </div>
    </div>
  )
}

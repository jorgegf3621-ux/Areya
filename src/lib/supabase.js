import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

const PORTAL_TOKEN_TTL_HOURS = 72

const normalizeEmail = (value = '') => value.trim().toLowerCase()
const addHours = (date, hours) => new Date(date.getTime() + hours * 60 * 60 * 1000)
const buildNombreCompleto = (row) => [row.nombre, row.ap_pat, row.ap_mat].filter(Boolean).join(' ').trim()
const fallbackToken = () => `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
const hasWebCrypto = typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined'

async function sha256(value) {
  if (!hasWebCrypto) return value
  const input = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', input)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function createActivationToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return fallbackToken()
}

async function ensurePortalAccessRecord(empleadoId, nombre) {
  const { data: existing, error } = await supabase
    .from('nuevos_ingresos')
    .select('*')
    .eq('empleado_id', empleadoId)
    .maybeSingle()
  if (error) throw error
  if (existing) return existing

  const { data, error: insertError } = await supabase
    .from('nuevos_ingresos')
    .insert({
      empleado_id: empleadoId,
      nombre,
      email_corporativo: null,
      contrasena: null,
      token_activacion: null,
      token_expira_at: null,
      password_creada: false,
    })
    .select()
    .single()
  if (insertError) throw insertError
  return data
}

// EMPLEADOS

export async function getEmpleados(filters = {}) {
  let query = supabase.from('empleados').select('*').order('id_colaborador')
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.departamento) query = query.eq('departamento', filters.departamento)
  if (filters.search) query = query.or(
    `nombre_completo.ilike.%${filters.search}%,rfc.ilike.%${filters.search}%,email_corporativo.ilike.%${filters.search}%`
  )
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getEmpleadoById(id) {
  const { data, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertEmpleado(row) {
  const { data, error } = await supabase
    .from('empleados')
    .upsert(row, { onConflict: 'id_colaborador', ignoreDuplicates: false })
    .select()
  if (error) throw error
  return data
}

export async function updateEmpleado(id, fields) {
  const { data, error } = await supabase
    .from('empleados')
    .update(fields)
    .eq('id', id)
    .select()
  if (error) throw error
  return data
}

export async function createEmpleadoDesdeFormulario(form) {
  const payload = {
    ...form,
    nombre_completo: buildNombreCompleto(form),
    status: 'Pendiente',
    onboarding_configurado: false,
    email_corporativo: null,
  }

  const { data, error } = await supabase
    .from('empleados')
    .insert(payload)
    .select()
    .single()
  if (error) throw error

  const access = await ensurePortalAccessRecord(data.id, data.nombre_completo)
  return { empleado: data, access }
}

// ONBOARDING TASKS

export async function getTasks(empleadoId) {
  const { data, error } = await supabase
    .from('onboarding_tasks')
    .select('*')
    .eq('empleado_id', empleadoId)
    .order('orden')
  if (error) throw error
  return data
}

export async function completeTask(taskId) {
  const { data, error } = await supabase
    .from('onboarding_tasks')
    .update({ completado: true, fecha_completado: new Date().toISOString() })
    .eq('id', taskId)
    .select()
  if (error) throw error
  return data
}

export async function createTasksFromTemplate(empleadoId, nivel) {
  const { data: existing, error: existingError } = await supabase
    .from('onboarding_tasks')
    .select('id')
    .eq('empleado_id', empleadoId)
    .limit(1)
  if (existingError) throw existingError
  if (existing?.length) return existing

  const { data: templates, error } = await supabase
    .from('onboarding_templates')
    .select('*')
    .or(`nivel.eq.${nivel},nivel.eq.todos`)
    .eq('activo', true)
    .order('orden')
  if (error) throw error

  if (!templates?.length) return []

  const tasks = templates.map(t => ({
    empleado_id: empleadoId,
    categoria: t.categoria,
    titulo: t.titulo,
    descripcion: t.descripcion,
    orden: t.orden,
  }))

  const { data, error: insertError } = await supabase
    .from('onboarding_tasks')
    .insert(tasks)
    .select()
  if (insertError) throw insertError
  return data
}

export async function markEmpleadoActivoSiOnboardingCompleto(empleadoId) {
  const tasks = await getTasks(empleadoId)
  if (!tasks.length || tasks.some(task => !task.completado)) return false

  const { error } = await supabase
    .from('empleados')
    .update({ status: 'Activo' })
    .eq('id', empleadoId)
    .eq('status', 'Onboarding')
  if (error) throw error
  return true
}

// ONBOARDING TEMPLATES

export async function getTemplates(nivel = null) {
  let query = supabase.from('onboarding_templates').select('*').eq('activo', true).order('nivel').order('orden')
  if (nivel) query = query.or(`nivel.eq.${nivel},nivel.eq.todos`)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function upsertTemplate(row) {
  const { data, error } = await supabase
    .from('onboarding_templates')
    .upsert(row, { onConflict: 'nivel,titulo', ignoreDuplicates: false })
    .select()
  if (error) throw error
  return data
}

// ACCESS REQUESTS

export async function getAccessRequests() {
  const { data, error } = await supabase
    .from('access_requests')
    .select('*, empleados(nombre_completo, departamento)')
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return data
}

export async function approveAccess(requestId, resolvedBy) {
  const { data, error } = await supabase
    .from('access_requests')
    .update({ status: 'approved', resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq('id', requestId)
    .select()
  if (error) throw error
  return data
}

export async function requestAccess(email) {
  const normalized = normalizeEmail(email)
  const { data: emp } = await supabase
    .from('empleados')
    .select('id, nombre_completo, status')
    .eq('email_corporativo', normalized)
    .single()

  if (!emp) return { error: 'no_employee' }
  if (emp.status === 'Inactivo') return { error: 'inactive' }

  const { data, error } = await supabase
    .from('access_requests')
    .insert({ empleado_id: emp.id, email: normalized })
    .select()
  if (error) throw error
  return { data, empleado: emp }
}

// NUEVOS INGRESOS / PORTAL ACCESS

export async function insertNuevoIngreso(form) {
  return createEmpleadoDesdeFormulario(form)
}

export async function getNuevosIngresos(status = null) {
  let query = supabase
    .from('nuevos_ingresos')
    .select('*, empleados(*)')
    .order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getPortalAccessByEmail(email) {
  const normalized = normalizeEmail(email)
  const { data, error } = await supabase
    .from('nuevos_ingresos')
    .select('*')
    .eq('email_corporativo', normalized)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getPortalAccessByToken(token) {
  if (!token) return null
  const { data, error } = await supabase
    .from('nuevos_ingresos')
    .select('*')
    .eq('token_activacion', token)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function configurarNuevoIngreso(empleadoId, empleadoData) {
  const normalizedEmail = normalizeEmail(empleadoData.email_corporativo)
  const now = new Date()
  const activationToken = createActivationToken()
  const tokenExpiraAt = addHours(now, PORTAL_TOKEN_TTL_HOURS).toISOString()

  const { data: duplicate, error: duplicateError } = await supabase
    .from('empleados')
    .select('id')
    .eq('email_corporativo', normalizedEmail)
    .neq('id', empleadoId)
    .maybeSingle()
  if (duplicateError) throw duplicateError
  if (duplicate) throw new Error('Ese correo corporativo ya está asignado a otro colaborador.')

  const { data: empleado, error } = await supabase
    .from('empleados')
    .update({
      ...empleadoData,
      email_corporativo: normalizedEmail,
      status: 'Onboarding',
      onboarding_configurado: true,
      onboarding_configurado_at: now.toISOString(),
    })
    .eq('id', empleadoId)
    .select()
    .single()
  if (error) throw error

  await ensurePortalAccessRecord(empleadoId, empleado.nombre_completo || empleadoData.nombre_completo)
  const { data: access, error: accessError } = await supabase
    .from('nuevos_ingresos')
    .update({
      nombre: empleado.nombre_completo || empleadoData.nombre_completo,
      email_corporativo: normalizedEmail,
      contrasena: null,
      password_creada: false,
      token_activacion: activationToken,
      token_expira_at: tokenExpiraAt,
      invitacion_enviada_at: now.toISOString(),
      status: 'configurado',
    })
    .eq('empleado_id', empleadoId)
    .select()
    .single()
  if (accessError) throw accessError

  await createTasksFromTemplate(empleadoId, empleadoData.nivel_tab)
  return { empleado, access }
}

export async function setPortalPassword(accessId, password) {
  const passwordHash = await sha256(password)
  const { data, error } = await supabase
    .from('nuevos_ingresos')
    .update({
      contrasena: passwordHash,
      password_creada: true,
      token_activacion: null,
      token_expira_at: null,
      password_actualizada_at: new Date().toISOString(),
    })
    .eq('id', accessId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function validatePortalPassword(email, password) {
  const access = await getPortalAccessByEmail(email)
  if (!access) return { error: 'invalid_email' }
  if (!access.contrasena) return { error: 'password_not_set', access }

  const passwordHash = await sha256(password)
  const valid = access.contrasena === passwordHash || access.contrasena === password
  if (!valid) return { error: 'invalid_password', access }

  const { data: empleado, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('id', access.empleado_id)
    .single()
  if (error) throw error

  if (empleado.status === 'Inactivo') return { error: 'inactive', access, empleado }
  return { access, empleado }
}

export async function getPortalAccessContextByEmail(email) {
  const access = await getPortalAccessByEmail(email)
  if (!access) return { error: 'invalid_email' }

  const { data: empleado, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('id', access.empleado_id)
    .single()
  if (error) throw error

  if (!access.email_corporativo) return { error: 'not_configured', access, empleado }
  if (empleado.status === 'Inactivo') return { error: 'inactive', access, empleado }
  return { access, empleado }
}

export async function getPortalAccessContextByToken(token) {
  const access = await getPortalAccessByToken(token)
  if (!access) return { error: 'invalid_token' }
  if (access.token_expira_at && new Date(access.token_expira_at) < new Date()) return { error: 'expired_token', access }

  const { data: empleado, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('id', access.empleado_id)
    .single()
  if (error) throw error

  return { access, empleado }
}

// ENTREVISTAS DE SALIDA

export async function insertEntrevistaSalida(empleadoId, respuestas) {
  const payload = {
    empleado_id: empleadoId,
    ...respuestas,
    completado: true,
    rrhh_completado: false,
    submitted_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('entrevistas_salida')
    .insert(payload)
    .select()
    .single()
  if (error) throw error

  await supabase
    .from('empleados')
    .update({ status: 'Offboarding' })
    .eq('id', empleadoId)

  return data
}

export async function getEntrevistasSalidaPendientes() {
  const { data, error } = await supabase
    .from('entrevistas_salida')
    .select('*, empleados(*)')
    .eq('completado', true)
    .or('rrhh_completado.is.false,rrhh_completado.is.null')
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return data
}

export async function completeOffboarding(entrevistaId, payload) {
  const fechaTermino = payload.fecha_termino || new Date().toISOString().slice(0, 10)
  const { data: entrevista, error } = await supabase
    .from('entrevistas_salida')
    .update({
      rrhh_completado: true,
      rrhh_completed_at: new Date().toISOString(),
      tipo_salida: payload.tipo_salida,
      subcategoria_salida: payload.subcategoria_salida,
      razon_rrhh: payload.razon_rrhh,
      comentarios_rrhh: payload.comentarios_rrhh,
      fecha_termino: fechaTermino,
      elegible_recontratacion: payload.elegible_recontratacion,
    })
    .eq('id', entrevistaId)
    .select()
    .single()
  if (error) throw error

  const razonTermino = payload.subcategoria_salida || payload.razon_rrhh || payload.tipo_salida
  const { error: empError } = await supabase
    .from('empleados')
    .update({
      status: 'Inactivo',
      fecha_termino: fechaTermino,
      razon_termino: razonTermino,
      tipo_salida: payload.tipo_salida,
      subcategoria_salida: payload.subcategoria_salida,
      comentarios_baja: payload.comentarios_rrhh,
      elegible_recontratacion: payload.elegible_recontratacion,
    })
    .eq('id', entrevista.empleado_id)
  if (empError) throw empError

  return entrevista
}

export async function completeEntrevistaSalida(entrevistaId, razonTermino) {
  const { data, error } = await supabase
    .from('entrevistas_salida')
    .update({ completado: true, razon_rrhh: razonTermino })
    .eq('id', entrevistaId)
    .select()
  if (error) throw error
  return data
}

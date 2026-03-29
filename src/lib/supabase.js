import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── EMPLEADOS ────────────────────────────────────────────────

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

// ── ONBOARDING TASKS ─────────────────────────────────────────

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
  // Jalar templates del nivel + todos
  const { data: templates, error } = await supabase
    .from('onboarding_templates')
    .select('*')
    .or(`nivel.eq.${nivel},nivel.eq.todos`)
    .eq('activo', true)
    .order('orden')
  if (error) throw error

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

// ── ONBOARDING TEMPLATES ─────────────────────────────────────

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

// ── ACCESS REQUESTS ──────────────────────────────────────────

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
  // Buscar empleado por email corporativo
  const { data: emp } = await supabase
    .from('empleados')
    .select('id, nombre_completo, status')
    .eq('email_corporativo', email)
    .single()

  if (!emp) return { error: 'no_employee' }
  if (emp.status === 'Inactivo') return { error: 'inactive' }

  const { data, error } = await supabase
    .from('access_requests')
    .insert({ empleado_id: emp.id, email })
    .select()
  if (error) throw error
  return { data, empleado: emp }
}

// ── ENTREVISTAS DE SALIDA ────────────────────────────────────

export async function insertEntrevistaSalida(empleadoId, respuestas) {
  const { data, error } = await supabase
    .from('entrevistas_salida')
    .insert({ empleado_id: empleadoId, ...respuestas })
    .select()
  if (error) throw error

  // Cambiar status a Offboarding
  await supabase
    .from('empleados')
    .update({ status: 'Offboarding' })
    .eq('id', empleadoId)

  return data
}

export async function completeEntrevistaSalida(entrevistaId, razonTermino) {
  const { data, error } = await supabase
    .from('entrevistas_salida')
    .update({ completado: true })
    .eq('id', entrevistaId)
    .select()
  if (error) throw error
  return data
}

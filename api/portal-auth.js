import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const APP_URL = 'https://areya-red.vercel.app/portal'

function json(res, status, body) {
  res.status(status).json(body)
}

function normalizeEmail(value = '') {
  return value.trim().toLowerCase()
}

function randomToken() {
  return crypto.randomBytes(32).toString('hex')
}

function futureIso(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored?.includes(':')) return stored === password
  const [salt, originalHash] = stored.split(':')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'))
}

async function getAccessByEmail(email) {
  const { data, error } = await supabase
    .from('nuevos_ingresos')
    .select('*, empleados(*)')
    .eq('email_corporativo', normalizeEmail(email))
    .maybeSingle()
  if (error) throw error
  return data
}

async function getAccessByToken(token, field = 'token_activacion') {
  const { data, error } = await supabase
    .from('nuevos_ingresos')
    .select('*, empleados(*)')
    .eq(field, token)
    .maybeSingle()
  if (error) throw error
  return data
}

function basePayload(access) {
  return {
    access: {
      id: access.id,
      email_corporativo: access.email_corporativo,
      password_creada: access.password_creada,
    },
    empleado: access.empleados,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const { action, email, password, token } = req.body || {}

  try {
    if (action === 'lookup_email') {
      const access = await getAccessByEmail(email)
      if (!access || !access.email_corporativo) return json(res, 404, { error: 'invalid_email' })
      if (access.empleados?.status === 'Inactivo') return json(res, 403, { error: 'inactive' })
      return json(res, 200, {
        next: access.contrasena ? 'login' : 'create_password',
        ...basePayload(access),
      })
    }

    if (action === 'lookup_activation') {
      const access = await getAccessByToken(token, 'token_activacion')
      if (!access) return json(res, 404, { error: 'invalid_token' })
      if (access.token_expira_at && new Date(access.token_expira_at) < new Date()) return json(res, 410, { error: 'expired_token' })
      return json(res, 200, {
        next: access.contrasena ? 'login' : 'create_password',
        ...basePayload(access),
      })
    }

    if (action === 'set_password') {
      const access = await getAccessByToken(token, 'token_activacion')
      if (!access) return json(res, 404, { error: 'invalid_token' })
      if (access.token_expira_at && new Date(access.token_expira_at) < new Date()) return json(res, 410, { error: 'expired_token' })
      if (!password || password.length < 8) return json(res, 400, { error: 'weak_password' })

      const passwordHash = hashPassword(password)
      const { error } = await supabase
        .from('nuevos_ingresos')
        .update({
          contrasena: passwordHash,
          password_creada: true,
          token_usado_at: new Date().toISOString(),
          token_activacion: null,
          token_expira_at: null,
          password_actualizada_at: new Date().toISOString(),
          status: 'activo',
        })
        .eq('id', access.id)
      if (error) throw error

      return json(res, 200, {
        ok: true,
        ...basePayload(access),
      })
    }

    if (action === 'login') {
      const access = await getAccessByEmail(email)
      if (!access || !access.email_corporativo) return json(res, 404, { error: 'invalid_email' })
      if (!access.contrasena) return json(res, 409, { error: 'password_not_set' })
      if (access.empleados?.status === 'Inactivo') return json(res, 403, { error: 'inactive' })
      if (!verifyPassword(password || '', access.contrasena)) return json(res, 401, { error: 'invalid_password' })

      await supabase
        .from('nuevos_ingresos')
        .update({ ultimo_acceso_at: new Date().toISOString(), status: 'activo' })
        .eq('id', access.id)

      return json(res, 200, {
        ok: true,
        ...basePayload(access),
      })
    }

    if (action === 'request_reset') {
      const access = await getAccessByEmail(email)
      if (!access || !access.email_corporativo) return json(res, 404, { error: 'invalid_email' })

      const resetToken = randomToken()
      const resetLink = `${APP_URL}?reset=${resetToken}`

      await supabase
        .from('nuevos_ingresos')
        .update({
          password_reset_token: resetToken,
          password_reset_expira_at: futureIso(2),
        })
        .eq('id', access.id)

      await fetch(`${req.headers.origin || 'https://areya-red.vercel.app'}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'portal_reset_password',
          data: {
            nombre: access.nombre || access.empleados?.nombre_completo || 'colaborador',
            email_corporativo: access.email_corporativo,
            reset_link: resetLink,
          },
        }),
      })

      return json(res, 200, { ok: true })
    }

    if (action === 'lookup_reset') {
      const access = await getAccessByToken(token, 'password_reset_token')
      if (!access) return json(res, 404, { error: 'invalid_token' })
      if (access.password_reset_expira_at && new Date(access.password_reset_expira_at) < new Date()) return json(res, 410, { error: 'expired_token' })
      return json(res, 200, basePayload(access))
    }

    if (action === 'reset_password') {
      const access = await getAccessByToken(token, 'password_reset_token')
      if (!access) return json(res, 404, { error: 'invalid_token' })
      if (access.password_reset_expira_at && new Date(access.password_reset_expira_at) < new Date()) return json(res, 410, { error: 'expired_token' })
      if (!password || password.length < 8) return json(res, 400, { error: 'weak_password' })

      const passwordHash = hashPassword(password)
      await supabase
        .from('nuevos_ingresos')
        .update({
          contrasena: passwordHash,
          password_creada: true,
          password_reset_token: null,
          password_reset_expira_at: null,
          password_actualizada_at: new Date().toISOString(),
        })
        .eq('id', access.id)

      return json(res, 200, { ok: true })
    }

    return json(res, 400, { error: 'unknown_action' })
  } catch (error) {
    console.error('portal-auth error:', error)
    return json(res, 500, { error: 'server_error' })
  }
}

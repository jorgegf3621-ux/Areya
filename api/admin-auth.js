import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

const ADMIN_URL = 'https://areya-red.vercel.app/admin'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' })

  const { action, email, password, token } = req.body || {}

  try {
    if (action === 'lookup_email') {
      const { data } = await supabase
        .from('staff_rh')
        .select('*')
        .eq('email', normalizeEmail(email))
        .eq('status', 'Activo')
        .maybeSingle()

      if (!data) return json(res, 404, { error: 'invalid_email' })
      return json(res, 200, { ok: true })
    }

    if (action === 'login') {
      const { data } = await supabase
        .from('staff_rh')
        .select('*')
        .eq('email', normalizeEmail(email))
        .eq('status', 'Activo')
        .maybeSingle()

      if (!data) return json(res, 404, { error: 'invalid_email' })
      if (!data.password_hash) return json(res, 409, { error: 'password_not_set' })
      if (!verifyPassword(password || '', data.password_hash)) return json(res, 401, { error: 'invalid_password' })

      await supabase.from('staff_rh').update({ last_login_at: new Date().toISOString() }).eq('id', data.id)

      return json(res, 200, {
        ok: true,
        user: {
          id: data.id,
          email: data.email,
          name: data.nombre_completo,
          rol: data.rol,
        },
      })
    }

    if (action === 'request_reset') {
      const { data } = await supabase
        .from('staff_rh')
        .select('*')
        .eq('email', normalizeEmail(email))
        .eq('status', 'Activo')
        .maybeSingle()

      if (!data) return json(res, 404, { error: 'invalid_email' })

      const resetToken = randomToken()
      const resetLink = `${ADMIN_URL}?reset=${resetToken}`

      await supabase
        .from('staff_rh')
        .update({
          password_reset_token: resetToken,
          password_reset_expira_at: futureIso(2),
        })
        .eq('id', data.id)

      await fetch(`${req.headers.origin || 'https://areya-red.vercel.app'}/api/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'admin_reset_password',
          data: {
            nombre: data.nombre_completo,
            email: data.email,
            reset_link: resetLink,
          },
        }),
      })

      return json(res, 200, { ok: true })
    }

    if (action === 'lookup_reset') {
      const { data } = await supabase
        .from('staff_rh')
        .select('*')
        .eq('password_reset_token', token)
        .maybeSingle()

      if (!data) return json(res, 404, { error: 'invalid_token' })
      if (data.password_reset_expira_at && new Date(data.password_reset_expira_at) < new Date()) {
        return json(res, 410, { error: 'expired_token' })
      }

      return json(res, 200, { ok: true, email: data.email })
    }

    if (action === 'reset_password') {
      const { data } = await supabase
        .from('staff_rh')
        .select('*')
        .eq('password_reset_token', token)
        .maybeSingle()

      if (!data) return json(res, 404, { error: 'invalid_token' })
      if (data.password_reset_expira_at && new Date(data.password_reset_expira_at) < new Date()) {
        return json(res, 410, { error: 'expired_token' })
      }
      if (!password || password.length < 8) return json(res, 400, { error: 'weak_password' })

      await supabase
        .from('staff_rh')
        .update({
          password_hash: hashPassword(password),
          password_reset_token: null,
          password_reset_expira_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)

      return json(res, 200, { ok: true })
    }

    return json(res, 400, { error: 'unknown_action' })
  } catch (error) {
    console.error('admin-auth error:', error)
    return json(res, 500, { error: 'server_error' })
  }
}

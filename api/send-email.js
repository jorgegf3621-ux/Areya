const RESEND_URL = 'https://api.resend.com/emails'
const FROM = 'Acme <onboarding@resend.dev>'
const PORTAL_URL = 'https://areya-red.vercel.app/portal'
const ADMIN_URL = 'https://areya-red.vercel.app/admin'

async function sendEmail({ to, subject, html }) {
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }

  return res.json()
}

function rrhhRecipients() {
  return [process.env.RRHH_EMAIL_1, process.env.RRHH_EMAIL_2].filter(Boolean)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { type, data } = req.body

  try {
    if (type === 'notify_rrhh') {
      const { nombre, ap_pat, ap_mat, email_personal, cargo, departamento, fecha_ingreso } = data
      const nombreCompleto = `${nombre} ${ap_pat} ${ap_mat || ''}`.trim()
      const to = rrhhRecipients()

      if (!to.length) return res.status(200).json({ ok: true, skipped: true })

      await sendEmail({
        to,
        subject: `Nuevo formulario de ingreso - ${nombreCompleto}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#1A1A2E;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;font-size:20px;margin:0">Areya RRHH</h1>
              <p style="color:rgba(255,255,255,.5);font-size:13px;margin:4px 0 0">Nuevo formulario de ingreso recibido</p>
            </div>
            <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:28px 32px;border-radius:0 0 12px 12px">
              <h2 style="font-size:17px;color:#111827;margin:0 0 16px">${nombreCompleto}</h2>
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <tr><td style="padding:6px 0;color:#6B7280;width:140px">Puesto solicitado</td><td style="padding:6px 0;font-weight:600;color:#111827">${cargo || '-'}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Area</td><td style="padding:6px 0;font-weight:600;color:#111827">${departamento || '-'}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Fecha de ingreso</td><td style="padding:6px 0;font-weight:600;color:#111827">${fecha_ingreso || '-'}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Correo personal</td><td style="padding:6px 0;font-weight:600;color:#111827">${email_personal || '-'}</td></tr>
              </table>
              <div style="margin-top:20px;padding:14px 16px;background:#EEF2FF;border-radius:8px;font-size:13px;color:#3730A3">
                <strong>Accion requerida:</strong> Asigna el correo corporativo y configura onboarding desde el panel de RRHH.
              </div>
              <div style="margin-top:20px;text-align:center">
                <a href="${ADMIN_URL}" style="background:#4F46E5;color:#fff;padding:11px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
                  Abrir panel de RRHH ->
                </a>
              </div>
            </div>
          </div>`,
      })

      return res.status(200).json({ ok: true })
    }

    if (type === 'welcome_empleado') {
      const { nombre, email_corporativo, cargo, departamento, activation_link } = data
      const portalLink = activation_link || PORTAL_URL

      await sendEmail({
        to: [email_corporativo],
        subject: `Bienvenido/a a Areya, ${nombre} - Tu acceso al portal`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#1A1A2E;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;font-size:20px;margin:0">Areya</h1>
              <p style="color:rgba(255,255,255,.5);font-size:13px;margin:4px 0 0">Portal de onboarding</p>
            </div>
            <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:28px 32px;border-radius:0 0 12px 12px">
              <h2 style="font-size:17px;color:#111827;margin:0 0 8px">Hola, ${nombre}</h2>
              <p style="font-size:14px;color:#6B7280;margin:0 0 20px;line-height:1.6">
                Estamos emocionados de que te unas al equipo como <strong style="color:#111827">${cargo}</strong> en el area de <strong style="color:#111827">${departamento}</strong>.
              </p>
              <div style="background:#F9FAFB;border-radius:10px;padding:18px 20px;margin-bottom:20px">
                <p style="font-size:13px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin:0 0 6px">Tu correo corporativo</p>
                <p style="font-size:16px;font-weight:700;color:#4F46E5;margin:0;font-family:monospace">${email_corporativo}</p>
              </div>
              <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6">
                Para ingresar a tu portal de onboarding, haz clic en el boton de abajo. Este enlace es personalizado y te permitira crear tu contrasena en tu primer acceso.
              </p>
              <div style="text-align:center;margin-bottom:24px">
                <a href="${portalLink}" style="background:#4F46E5;color:#fff;padding:13px 28px;border-radius:9px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block">
                  Activar mi acceso ->
                </a>
              </div>
              <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0">
                Si el enlace expira, solicita a RRHH el reenvio de tu invitacion.
              </p>
            </div>
          </div>`,
      })

      return res.status(200).json({ ok: true })
    }

    if (type === 'notify_rrhh_offboarding') {
      const { nombre, cargo, departamento, motivo_salida } = data
      const to = rrhhRecipients()

      if (!to.length) return res.status(200).json({ ok: true, skipped: true })

      await sendEmail({
        to,
        subject: `Salida pendiente de cierre - ${nombre}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#7F1D1D;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;font-size:20px;margin:0">Areya RRHH</h1>
              <p style="color:rgba(255,255,255,.6);font-size:13px;margin:4px 0 0">Entrevista de salida completada</p>
            </div>
            <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:28px 32px;border-radius:0 0 12px 12px">
              <h2 style="font-size:17px;color:#111827;margin:0 0 16px">${nombre}</h2>
              <table style="width:100%;border-collapse:collapse;font-size:13px">
                <tr><td style="padding:6px 0;color:#6B7280;width:140px">Puesto</td><td style="padding:6px 0;font-weight:600;color:#111827">${cargo || '-'}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Area</td><td style="padding:6px 0;font-weight:600;color:#111827">${departamento || '-'}</td></tr>
                <tr><td style="padding:6px 0;color:#6B7280">Motivo declarado</td><td style="padding:6px 0;font-weight:600;color:#111827">${motivo_salida || '-'}</td></tr>
              </table>
              <div style="margin-top:20px;padding:14px 16px;background:#FEF2F2;border-radius:8px;font-size:13px;color:#991B1B">
                <strong>Accion requerida:</strong> Completa el offboarding en el panel de RRHH para clasificar la salida y cerrar la baja.
              </div>
              <div style="margin-top:20px;text-align:center">
                <a href="${ADMIN_URL}" style="background:#4F46E5;color:#fff;padding:11px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
                  Abrir panel de RRHH ->
                </a>
              </div>
            </div>
          </div>`,
      })

      return res.status(200).json({ ok: true })
    }

    if (type === 'portal_reset_password') {
      const { nombre, email_corporativo, reset_link } = data

      await sendEmail({
        to: [email_corporativo],
        subject: `Recupera tu acceso al portal, ${nombre}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#1A1A2E;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;font-size:20px;margin:0">Areya</h1>
              <p style="color:rgba(255,255,255,.5);font-size:13px;margin:4px 0 0">Recuperación de contraseña</p>
            </div>
            <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:28px 32px;border-radius:0 0 12px 12px">
              <h2 style="font-size:17px;color:#111827;margin:0 0 12px">Hola, ${nombre}</h2>
              <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6">
                Recibimos una solicitud para restablecer tu contraseña del portal de onboarding.
              </p>
              <div style="text-align:center;margin-bottom:24px">
                <a href="${reset_link}" style="background:#4F46E5;color:#fff;padding:13px 28px;border-radius:9px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block">
                  Restablecer contraseña →
                </a>
              </div>
              <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0">
                Este enlace expira en 2 horas. Si no solicitaste este cambio, puedes ignorar este correo.
              </p>
            </div>
          </div>`,
      })

      return res.status(200).json({ ok: true })
    }

    if (type === 'admin_reset_password') {
      const { nombre, email, reset_link } = data

      await sendEmail({
        to: [email],
        subject: `Recupera tu acceso al panel, ${nombre}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <div style="background:#1A1A2E;padding:24px 32px;border-radius:12px 12px 0 0">
              <h1 style="color:#fff;font-size:20px;margin:0">Areya RRHH</h1>
              <p style="color:rgba(255,255,255,.5);font-size:13px;margin:4px 0 0">Recuperación de acceso admin</p>
            </div>
            <div style="background:#fff;border:1px solid #E5E7EB;border-top:none;padding:28px 32px;border-radius:0 0 12px 12px">
              <h2 style="font-size:17px;color:#111827;margin:0 0 12px">Hola, ${nombre}</h2>
              <p style="font-size:14px;color:#374151;margin:0 0 20px;line-height:1.6">
                Recibimos una solicitud para restablecer tu contraseña del panel de administración.
              </p>
              <div style="text-align:center;margin-bottom:24px">
                <a href="${reset_link}" style="background:#4F46E5;color:#fff;padding:13px 28px;border-radius:9px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block">
                  Restablecer contraseña →
                </a>
              </div>
              <p style="font-size:12px;color:#9CA3AF;text-align:center;margin:0">
                Este enlace expira en 2 horas. Si no solicitaste este cambio, puedes ignorar este correo.
              </p>
            </div>
          </div>`,
      })

      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Tipo de email no reconocido' })
  } catch (e) {
    console.error('send-email error:', e)
    return res.status(500).json({ error: e.message })
  }
}

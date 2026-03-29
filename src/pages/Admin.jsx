import { useState, useEffect, useRef } from 'react'
import { supabase, getEmpleados, updateEmpleado, getAccessRequests, approveAccess, upsertEmpleado, upsertTemplate } from '../lib/supabase'
import * as XLSX from 'xlsx'

const ADMIN_USERS = [
  { email: 'estefania.saldivar@areya.com.mx', pass: 'Chapis123', name: 'Estefanía Saldívar', rol: 'Admin RRHH', initials: 'ES' },
  { email: 'f.hernandez@areya.com.mx', pass: 'admin2026', name: 'Francisco Hernández', rol: 'Director RRHH', initials: 'FH' },
  { email: 'demo', pass: 'demo', name: 'Demo Admin', rol: 'Admin RRHH', initials: 'DA' },
]

const STATUS_BADGE = {
  Activo: 'badge-active',
  Onboarding: 'badge-onboarding',
  Offboarding: 'badge-offboarding',
  Inactivo: 'badge-inactive',
}

const MASTER_COL_MAP = {
  'id colaborador':'id_colaborador','status':'status','uen':'uen','razon social':'razon_social',
  'nombre':'nombre','apellido paterno':'ap_pat','ap. paterno':'ap_pat','apellido materno':'ap_mat','ap. materno':'ap_mat',
  'fecha de nacimiento':'fecha_nac','fecha nacimiento':'fecha_nac','genero':'genero','género':'genero',
  'estado civil':'estado_civil','nacionalidad':'nacionalidad','rfc':'rfc','curp':'curp','nss':'nss',
  'direccion':'direccion','dirección':'direccion','municipio':'municipio',
  'fecha de ingreso':'fecha_ingreso','fecha ingreso':'fecha_ingreso',
  'departamento':'departamento','area':'departamento','área':'departamento',
  'cargo':'cargo','puesto':'cargo','tipo de contrato':'tipo_contrato','tipo contrato':'tipo_contrato',
  'jefe directo':'jefe_directo','supervisor':'jefe_directo',
  'email corporativo':'email_corporativo','correo corporativo':'email_corporativo',
  'fecha termino':'fecha_termino','razon de termino':'razon_termino',
  'antiguedad':'antiguedad','antigüedad':'antiguedad',
  'familia de puesto':'familia_puesto','nivel tab':'nivel_tab','nivel':'nivel_tab',
  'gente a cargo':'gente_a_cargo','sueldo bruto':'sueldo_bruto','sueldo neto':'sueldo_neto',
  'gasolina':'gasolina','despensa':'despensa','fondo de ahorro':'fondo_ahorro',
  'meses bono':'meses_bono','% prima':'pct_prima','prima vacacional':'prima_vacacional',
  'mant. auto':'mant_auto','monto celular':'monto_celular','celular':'celular',
  'sgmm':'sgmm','seguro de vida':'seguro_vida','comentarios':'comentarios',
  'costo real mensual':'costo_real_mens','costo real anual':'costo_real_anual',
  'costo real anual 2026':'costo_real_anual',
}

const TAREAS_COL_MAP = {
  'nivel':'nivel','categoria':'categoria','categoría':'categoria',
  'titulo':'titulo','título':'titulo','descripcion':'descripcion','descripción':'descripcion','orden':'orden',
}

function normalizeKey(k) { return k.toString().toLowerCase().trim().replace(/\s+/g,' ') }
function mapRow(row, colMap) {
  const mapped = {}
  Object.entries(row).forEach(([k, v]) => {
    const db = colMap[normalizeKey(k)]
    if (db) mapped[db] = v === '' ? null : v
  })
  return mapped
}

export default function Admin() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [empleados, setEmpleados] = useState([])
  const [accessReqs, setAccessReqs] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  // Import state
  const [importTab, setImportTab] = useState('master')
  const [importData, setImportData] = useState(null)
  const [importLog, setImportLog] = useState(null)
  const [importing, setImporting] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    if (user && page === 'master') loadEmpleados()
    if (user && page === 'accesos') loadAccess()
  }, [user, page])

  const loadEmpleados = async () => {
    setLoading(true)
    try { const data = await getEmpleados({ search, status: statusFilter }); setEmpleados(data) }
    catch (e) { showToast('Error al cargar empleados') }
    finally { setLoading(false) }
  }

  const loadAccess = async () => {
    try { const data = await getAccessRequests(); setAccessReqs(data) }
    catch (e) { console.error(e) }
  }

  const handleApproveAccess = async (id) => {
    await approveAccess(id, user.name)
    showToast('✓ Acceso aprobado')
    loadAccess()
  }

  // ── LOGIN ─────────────────────────────────────────────────
  if (!user) {
    const [loginEmail, setLoginEmail] = useState('')
    const [loginPass, setLoginPass] = useState('')
    const [loginErr, setLoginErr] = useState('')
    const doLogin = () => {
      const u = ADMIN_USERS.find(u => u.email.toLowerCase() === loginEmail.toLowerCase() && u.pass === loginPass)
      if (!u) { setLoginErr('Correo o contraseña incorrectos'); return }
      setUser(u)
    }
    return (
      <div className="min-h-screen bg-brand flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="bg-brand px-8 pt-8 pb-6 text-center">
            <div className="font-serif text-white text-2xl font-bold">Areya</div>
            <div className="text-white/50 text-sm mt-1">Panel de Recursos Humanos</div>
          </div>
          <div className="px-8 py-7 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Correo</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                placeholder="tu.nombre@areya.com.mx"
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contraseña</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent"
                onKeyDown={e => e.key === 'Enter' && doLogin()} />
            </div>
            {loginErr && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{loginErr}</div>}
            <button onClick={doLogin} className="btn-primary w-full py-2.5">Entrar</button>
            <div className="text-xs text-gray-400 text-center">demo / demo para acceso de prueba</div>
          </div>
        </div>
      </div>
    )
  }

  // ── IMPORT LOGIC ──────────────────────────────────────────
  const processFile = (file, type) => {
    const reader = new FileReader()
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (!rows.length) { showToast('⚠ El archivo está vacío'); return }
      setImportData({ rows, fileName: file.name, type })
      setImportLog(null)
    }
    reader.readAsArrayBuffer(file)
  }

  const runImport = async () => {
    if (!importData) return
    setImporting(true)
    const { rows, type } = importData
    const colMap = type === 'master' ? MASTER_COL_MAP : TAREAS_COL_MAP
    let inserted = 0, updated = 0, skipped = 0, lines = []

    for (let i = 0; i < rows.length; i++) {
      const mapped = mapRow(rows[i], colMap)
      const keyCol = type === 'master' ? 'id_colaborador' : 'titulo'
      if (!mapped[keyCol]) { skipped++; lines.push(`⚠ Fila ${i+2}: sin ${keyCol}, omitida`); continue }
      if (type === 'tareas' && !mapped.nivel) { skipped++; lines.push(`⚠ Fila ${i+2}: sin nivel, omitida`); continue }

      try {
        if (type === 'master') {
          const { data: existing } = await supabase.from('empleados').select('id').eq('id_colaborador', mapped.id_colaborador).single()
          if (existing) {
            await updateEmpleado(existing.id, mapped)
            updated++; lines.push(`✓ Actualizado: ${mapped.id_colaborador}`)
          } else {
            await supabase.from('empleados').insert(mapped)
            inserted++; lines.push(`+ Insertado: ${mapped.id_colaborador}`)
          }
        } else {
          await upsertTemplate(mapped)
          inserted++; lines.push(`✓ Tarea: ${mapped.titulo} (${mapped.nivel})`)
        }
      } catch (err) {
        skipped++; lines.push(`✗ Fila ${i+2}: ${err.message?.slice(0, 60)}`)
      }
    }

    setImportLog({ inserted, updated, skipped, lines })
    setImporting(false)
    showToast(`✓ Importación completa — ${inserted} nuevos · ${updated} actualizados`)
    if (type === 'master') loadEmpleados()
  }

  const downloadTemplate = () => {
    const data = [
      { nivel: 'Practicante', categoria: 'Previo al ingreso', titulo: 'Firma de contrato', descripcion: '', orden: 1 },
      { nivel: 'Analista', categoria: 'Inducción', titulo: 'Reunión con el equipo', descripcion: '', orden: 1 },
      { nivel: 'todos', categoria: 'Políticas', titulo: 'Código de conducta', descripcion: '', orden: 1 },
    ]
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Tareas')
    XLSX.writeFile(wb, 'plantilla_tareas_onboarding.xlsx')
  }

  // ── SIDEBAR ITEMS ─────────────────────────────────────────
  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'master', label: 'Master de empleados' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'accesos', label: `Accesos ${accessReqs.length ? `(${accessReqs.length})` : ''}` },
    { id: 'importar', label: 'Importar datos' },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-52 bg-brand flex flex-col flex-shrink-0">
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <div className="font-serif text-white text-lg font-bold">Areya</div>
          <div className="text-white/40 text-xs mt-0.5">Sistema de RRHH</div>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className={`w-full text-left px-5 py-2.5 text-sm font-medium transition-all border-l-2
                ${page === item.id ? 'bg-indigo-500/25 text-white border-accent' : 'text-white/55 border-transparent hover:bg-white/5 hover:text-white/90'}`}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{user.initials}</div>
          <div>
            <div className="text-white text-xs font-semibold">{user.name}</div>
            <div className="text-white/40 text-xs">{user.rol}</div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        {/* Topbar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 h-13 flex items-center justify-between">
          <div className="font-serif text-base font-bold capitalize">{page.replace('master', 'Master de empleados').replace('importar', 'Importar datos').replace('accesos', 'Gestión de accesos').replace('onboarding', 'Onboarding').replace('dashboard', 'Dashboard')}</div>
        </div>

        <div className="p-6">

          {/* ── DASHBOARD ── */}
          {page === 'dashboard' && (
            <div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { n: empleados.filter(e => e.status === 'Activo').length || '—', l: 'Colaboradores activos', c: 'text-accent' },
                  { n: empleados.filter(e => e.status === 'Onboarding').length || '—', l: 'En onboarding', c: 'text-emerald-600' },
                  { n: accessReqs.length || '—', l: 'Accesos pendientes', c: 'text-amber-600' },
                  { n: empleados.filter(e => e.status === 'Offboarding').length || '—', l: 'En offboarding', c: 'text-red-500' },
                ].map((s, i) => (
                  <div key={i} className="card">
                    <div className={`font-serif text-3xl font-bold ${s.c}`}>{s.n}</div>
                    <div className="text-gray-500 text-sm mt-1">{s.l}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="font-serif text-sm font-bold mb-3">Accesos de acceso pendientes de aprobar</div>
                {accessReqs.length === 0
                  ? <div className="text-gray-400 text-sm">No hay solicitudes pendientes ✓</div>
                  : accessReqs.slice(0, 3).map(r => (
                    <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                      <div>
                        <div className="text-sm font-semibold">{r.empleados?.nombre_completo || r.email}</div>
                        <div className="text-xs text-gray-400">{r.email}</div>
                      </div>
                      <button onClick={() => handleApproveAccess(r.id)} className="btn-primary text-xs px-3 py-1.5">Aprobar</button>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* ── MASTER ── */}
          {page === 'master' && (
            <div>
              <div className="flex gap-3 mb-4 flex-wrap">
                <input type="text" placeholder="Buscar nombre, RFC, email..." value={search}
                  onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadEmpleados()}
                  className="flex-1 min-w-48 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent" />
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); }}
                  className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none bg-white">
                  <option value="">Todos los estatus</option>
                  {['Activo','Onboarding','Offboarding','Inactivo'].map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={loadEmpleados} className="btn-primary px-4">Buscar</button>
              </div>
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['ID', 'Nombre', 'RFC', 'Departamento', 'Cargo', 'Email', 'Ingreso', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {loading && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Cargando...</td></tr>}
                      {!loading && empleados.length === 0 && (
                        <tr><td colSpan={8} className="text-center py-8 text-gray-400">No hay registros. Importa el master para comenzar.</td></tr>
                      )}
                      {empleados.map(e => (
                        <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{e.id_colaborador}</td>
                          <td className="px-4 py-3 font-semibold text-accent whitespace-nowrap">{e.nombre_completo}</td>
                          <td className="px-4 py-3 font-mono text-xs">{e.rfc || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{e.departamento || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-36 truncate">{e.cargo || '—'}</td>
                          <td className="px-4 py-3 font-mono text-xs text-indigo-600">{e.email_corporativo || '—'}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {e.fecha_ingreso ? new Date(e.fecha_ingreso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={STATUS_BADGE[e.status] || 'badge-inactive'}>{e.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                  {empleados.length} colaboradores
                </div>
              </div>
            </div>
          )}

          {/* ── ACCESOS ── */}
          {page === 'accesos' && (
            <div className="max-w-xl">
              <div className="card mb-4">
                <div className="font-serif text-sm font-bold mb-3">Solicitudes pendientes <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full ml-1">{accessReqs.length}</span></div>
                {accessReqs.length === 0
                  ? <div className="text-gray-400 text-sm py-4 text-center">No hay solicitudes pendientes ✓</div>
                  : accessReqs.map(r => (
                    <div key={r.id} className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-3">
                      <div className="font-semibold text-sm">{r.empleados?.nombre_completo || '—'}</div>
                      <div className="text-xs text-gray-500 mb-1">{r.empleados?.departamento || '—'}</div>
                      <div className="font-mono text-sm text-indigo-700 bg-white border border-indigo-100 rounded-lg px-3 py-2 mb-3">{r.email}</div>
                      <div className="text-xs text-gray-400 mb-3">
                        Al aprobar, Supabase enviará un magic link al correo corporativo del colaborador.
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveAccess(r.id)} className="flex-1 btn-primary text-sm py-2">✓ Aprobar y enviar magic link</button>
                        <button className="btn-ghost text-sm py-2">Rechazar</button>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* ── IMPORTAR ── */}
          {page === 'importar' && (
            <div className="max-w-2xl">
              {/* Tabs */}
              <div className="flex gap-2 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
                {['master', 'tareas'].map(t => (
                  <button key={t} onClick={() => { setImportTab(t); setImportData(null); setImportLog(null) }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${importTab === t ? 'bg-white text-brand shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t === 'master' ? 'Master de empleados' : 'Plantilla de tareas'}
                  </button>
                ))}
              </div>

              {/* Info */}
              <div className={`card mb-4 border-l-4 ${importTab === 'master' ? 'border-accent' : 'border-purple-500'}`}>
                {importTab === 'master' ? (
                  <div className="text-sm text-gray-600 leading-relaxed">
                    <strong className="text-gray-800">Columna siempre requerida:</strong> <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs">ID Colaborador</code><br />
                    <span className="text-xs text-gray-500 mt-1 block">Carga completa: trae todas las columnas. Actualización parcial: ID Colaborador + columnas a cambiar. Celdas vacías → null.</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 leading-relaxed">
                    Columnas: <code className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs">nivel</code> <code className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs">categoria</code> <code className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs">titulo</code> <code className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs">descripcion</code> <code className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs">orden</code><br />
                    <button onClick={downloadTemplate} className="text-xs text-purple-600 underline mt-1">⬇ Descargar plantilla de ejemplo</button>
                  </div>
                )}
              </div>

              {/* Drop zone */}
              {!importData && !importLog && (
                <label className="block border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-accent hover:bg-indigo-50/50 transition-all">
                  <div className="text-3xl mb-3">📂</div>
                  <div className="text-sm font-semibold text-gray-700 mb-1">Arrastra o haz clic para subir</div>
                  <div className="text-xs text-gray-400">.xlsx · .xls · .csv</div>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files[0] && processFile(e.target.files[0], importTab)} />
                </label>
              )}

              {/* Preview */}
              {importData && !importLog && (
                <div className="card">
                  <div className="font-serif text-sm font-bold mb-3">{importData.fileName}</div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { n: importData.rows.length, l: 'Total filas' },
                      { n: Object.keys(importData.rows[0]).length, l: 'Columnas' },
                      { n: importData.type === 'master' ? 'UPSERT' : 'Tareas', l: 'Modo' },
                    ].map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="font-serif text-xl font-bold text-accent">{s.n}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{s.l}</div>
                      </div>
                    ))}
                  </div>
                  {/* 5 row preview */}
                  <div className="overflow-x-auto rounded-lg border border-gray-100 mb-4">
                    <table className="text-xs w-full border-collapse">
                      <thead><tr className="bg-gray-50">{Object.keys(importData.rows[0]).map(h => <th key={h} className="px-3 py-2 text-left font-bold text-gray-400 whitespace-nowrap border-b border-gray-100">{h}</th>)}</tr></thead>
                      <tbody>{importData.rows.slice(0, 5).map((r, i) => <tr key={i} className="border-b border-gray-50">{Object.keys(importData.rows[0]).map(h => <td key={h} className="px-3 py-2 whitespace-nowrap max-w-32 truncate">{r[h] ?? ''}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setImportData(null)} className="btn-ghost">Cancelar</button>
                    <button onClick={runImport} disabled={importing} className="btn-primary">
                      {importing ? 'Importando...' : `Importar ${importData.rows.length} filas →`}
                    </button>
                  </div>
                </div>
              )}

              {/* Log */}
              {importLog && (
                <div className="card">
                  <div className="font-serif text-sm font-bold mb-3">Resultado</div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { n: importLog.inserted, l: 'Insertados', c: 'text-accent' },
                      { n: importLog.updated, l: 'Actualizados', c: 'text-emerald-600' },
                      { n: importLog.skipped, l: 'Omitidos', c: importLog.skipped ? 'text-red-500' : 'text-gray-400' },
                    ].map((s, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className={`font-serif text-2xl font-bold ${s.c}`}>{s.n}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed">
                    {importLog.lines.map((l, i) => (
                      <div key={i} className={l.startsWith('✓') || l.startsWith('+') ? 'text-emerald-700' : l.startsWith('⚠') ? 'text-amber-600' : 'text-red-600'}>{l}</div>
                    ))}
                  </div>
                  <button onClick={() => { setImportData(null); setImportLog(null) }} className="btn-ghost mt-3 w-full">Nueva importación</button>
                </div>
              )}
            </div>
          )}

          {/* ── ONBOARDING placeholder ── */}
          {page === 'onboarding' && (
            <div className="card max-w-lg text-gray-500 text-sm">
              El módulo de onboarding muestra los empleados activos con su progreso de tareas. Próximamente con datos en tiempo real de Supabase.
            </div>
          )}

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  )
}

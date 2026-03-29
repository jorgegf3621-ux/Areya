import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  supabase,
  completeOffboarding,
  configurarNuevoIngreso,
  getEmpleados,
  getEntrevistasSalidaPendientes,
  getTabuladorRows,
  updateEmpleado,
  upsertTabuladorRow,
  upsertTemplate,
} from '../lib/supabase'
import { TABULADOR, calcCompensacion } from '../lib/tabulador'
import Chart from 'chart.js/auto'
import * as XLSX from 'xlsx'

const ADMIN_SESSION_KEY = 'areya_admin_session'

// Constants

const MASTER_COL_MAP = {
  'id colaborador':'ID Colaborador','idcolaborador':'ID Colaborador','id de colaborador':'ID Colaborador','id del colaborador':'ID Colaborador',
  'numero de colaborador':'ID Colaborador','no colaborador':'ID Colaborador','num colaborador':'ID Colaborador','colaborador id':'ID Colaborador',
  'status':'status','uen':'uen','razon social':'razon_social',
  'nombre completo':'nombre_completo','nombre':'nombre','apellido paterno':'ap_pat','ap. paterno':'ap_pat','apellido materno':'ap_mat','ap. materno':'ap_mat',
  'fecha de nacimiento':'fecha_nac','fecha nacimiento':'fecha_nac','genero':'genero','género':'genero',
  'estado civil':'estado_civil','nacionalidad':'nacionalidad','rfc':'rfc','curp':'curp','nss':'nss',
  'direccion':'direccion','dirección':'direccion','municipio':'municipio',
  'fecha de ingreso':'fecha_ingreso','fecha ingreso':'fecha_ingreso',
  'departamento':'departamento','area':'departamento','área':'departamento',
  'cargo':'Puesto','puesto':'Puesto','tipo de contrato':'Tipo de contratación','tipo contrato':'Tipo de contratación','tipo de contratacion':'Tipo de contratación',
  'jefe directo':'jefe_directo','supervisor':'jefe_directo',
  'email corporativo':'email_corporativo','correo corporativo':'email_corporativo',
  'fecha termino':'fecha_termino','razon de termino':'razon_termino',
  'antiguedad':'antiguedad','antigüedad':'antiguedad',
  'familia de puesto':'familia_puesto','familia puesto':'familia_puesto','familia':'familia_puesto',
  'nivel tab':'nivel_tab','nivel':'nivel_tab','nivel tabulador':'nivel_tab',
  'gente a cargo':'gente_a_cargo',
  'sueldo bruto':'sueldo_bruto','sueldo bruto mensual':'sueldo_bruto','sueldo mensual bruto':'sueldo_bruto',
  'sueldo neto':'sueldo_neto','sueldo neto mensual':'sueldo_neto',
  'gasolina':'gasolina',
  'despensa':'despensa','despensa 12%':'despensa','despensa 12 %':'despensa',
  'fondo de ahorro':'fondo_ahorro','fondo ahorro':'fondo_ahorro',
  'meses bono':'meses_bono','meses de bono':'meses_bono',
  '% prima':'pct_prima','pct prima':'pct_prima','porcentaje prima vacacional':'pct_prima','porcentaje prima vacacional 2026':'pct_prima',
  'prima vacacional':'prima_vacacional','prima vacacional 2026':'prima_vacacional',
  'mant. auto':'mant_auto','mantenimiento':'mant_auto','mantenimiento auto':'mant_auto','mant auto':'mant_auto',
  'monto celular':'monto_celular','celular':'celular',
  'sgmm':'sgmm','gastos medicos':'sgmm','gastos medicos mayores':'sgmm','gmm':'sgmm','seguro gastos medicos':'sgmm',
  'seguro de vida':'seguro_vida','vida':'seguro_vida','comentarios':'comentarios',
  'rango sueldo':'rango_sueldo','rango de sueldo':'rango_sueldo',
  'punto medio':'punto_medio',
  'diferencia en %':'dif_pct','diferencia %':'dif_pct','diferencia en porcentaje':'dif_pct','diferencia pct':'dif_pct',
  'diferencia $':'dif_pesos','diferencia pesos':'dif_pesos','diferencia en pesos':'dif_pesos','diferencia en $':'dif_pesos',
  'costo real mensual':'costo_real_mens','costo real anual':'costo_real_anual',
  'costo real anual 2026':'costo_real_anual',
}

const TAREAS_COL_MAP = {
  'nivel':'nivel','categoria':'categoria','categoría':'categoria',
  'titulo':'titulo','título':'titulo','descripcion':'descripcion','descripción':'descripcion','orden':'orden',
}

const REF_COL = 'Referencia objetivo (80%)'
const LIM_INF_COL = 'Límite inferior de banda'
const LIM_SUP_COL = 'Límite superior de banda (120%)'

const TABULADOR_COL_MAP = {
  'familia de puesto':'familia_puesto','familia puesto':'familia_puesto','familia':'familia_puesto',
  'nivel':'nivel',
  'referencia c':REF_COL,'referencia comp':REF_COL,'referencia':REF_COL,'referencia objetivo':REF_COL,'referencia objetivo 80':REF_COL,
  'brinco':'brinco','brinco %':'brinco','porcentaje brinco':'brinco',
  'limite inferior':LIM_INF_COL,'limite inf':LIM_INF_COL,'limite inferi':LIM_INF_COL,'limite inferior $':LIM_INF_COL,'limite inferior de banda':LIM_INF_COL,
  'limite superior':LIM_SUP_COL,'limite sup':LIM_SUP_COL,'limite super':LIM_SUP_COL,'limite superior $':LIM_SUP_COL,'limite superior de banda':LIM_SUP_COL,'limite superior de banda 120':LIM_SUP_COL,
  'rango':'rango',
}

const STATUS_CLS = {
  Pendiente: 'bg-slate-100 text-slate-700',
  Activo: 'bg-emerald-100 text-emerald-800',
  Onboarding: 'bg-indigo-100 text-indigo-800',
  Offboarding: 'bg-amber-100 text-amber-800',
  Inactivo: 'bg-gray-100 text-gray-500',
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const BRAND = '#201D36'
const ACCENT = '#9A90F5'
const CHART_COLORS = [ACCENT,'#10B981','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#EA580C']
const OFFBOARDING_REASON_TYPES = {
  Voluntaria: [
    'Mejor oferta económica',
    'Mejor oportunidad de crecimiento',
    'Cambio de industria o carrera',
    'Motivos personales',
    'Motivos familiares',
    'Cambio de residencia',
    'Salud',
    'Estudios',
    'Emprendimiento',
    'Inconformidad con liderazgo',
    'Inconformidad con ambiente laboral',
    'Inconformidad con compensación',
    'Inconformidad con carga de trabajo',
    'Falta de desarrollo profesional',
    'Falta de flexibilidad laboral',
  ],
  Involuntaria: [
    'Bajo desempeño',
    'Incumplimiento de políticas',
    'Reestructura organizacional',
    'Eliminación de puesto',
    'Fin de contrato temporal',
    'Ausentismo',
    'Falta grave o conducta inapropiada',
    'Abandono de trabajo',
    'No aprobación de periodo de prueba',
    'Ajuste presupuestal',
  ],
  Mutua: [
    'Separación por acuerdo mutuo',
    'Reubicación no viable',
    'Cambio de rol no aceptado',
    'Cierre de proyecto',
    'Condiciones laborales no compatibles',
  ],
}

// Utilities

function normalizeKey(k) {
  return k
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.#/\\_\-()\[\]{}]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function mapRow(row, colMap) {
  const out = {}
  Object.entries(row).forEach(([k,v]) => { const db = colMap[normalizeKey(k)]; if (db) out[db] = v==='' ? null : v })
  return out
}

function findHeaderRowIndex(matrix, type) {
  const expected = type === 'master'
    ? ['id colaborador', 'nombre', 'nombre completo', 'rfc', 'email corporativo', 'nivel', 'familia de puesto', 'referencia c']
    : ['nivel', 'categoria', 'titulo', 'descripcion', 'orden']

  let bestIndex = 0
  let bestScore = -1

  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = (matrix[i] || []).map(cell => normalizeKey(cell))
    const score = expected.reduce((total, key) => total + (row.includes(key) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestIndex = i
    }
  }

  return bestIndex
}

function buildRowsFromMatrix(matrix, headerRowIndex) {
  const headers = (matrix[headerRowIndex] || []).map(cell => String(cell ?? '').trim())
  const rows = []

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const row = matrix[i] || []
    const hasContent = row.some(cell => String(cell ?? '').trim() !== '')
    if (!hasContent) continue

    const obj = {}
    headers.forEach((header, colIndex) => {
      if (!header) return
      obj[header] = row[colIndex] ?? ''
    })
    rows.push(obj)
  }

  return rows
}

function parseMoneyLike(value) {
  if (value == null || value === '') return null
  const cleaned = String(value).replace(/[$,\s]/g, '').trim()
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parsePercentLike(value) {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (raw.includes('%')) {
    const parsed = Number(raw.replace(/[%\s,]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  const parsed = Number(raw.replace(/[\s,]/g, ''))
  if (!Number.isFinite(parsed)) return null
  return parsed <= 1 ? parsed * 100 : parsed
}

const TABULADOR_FIELDS = new Set(Object.values(TABULADOR_COL_MAP))
const MASTER_FIELDS = new Set(Object.values(MASTER_COL_MAP))
const fmt = n => n != null ? '$'+Number(n).toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:0}) : '—'
const fmtDate = d => { if(!d) return '—'; try { return new Date(d+'T12:00').toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}) } catch { return d } }
const yrsDiff = d => d ? (Date.now()-new Date(d).getTime())/(1000*60*60*24*365.25) : 0

async function adminAuth(action, payload = {}) {
  const res = await fetch('/api/admin-auth', {
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

function exportWorkbook(fileName, sheets) {
  const wb = XLSX.utils.book_new()
  sheets.forEach(({ name, rows }) => {
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, name)
  })
  XLSX.writeFile(wb, fileName)
}

// â”€â”€â”€ SHARED CHART BASE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const BASE_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#9CA3AF' } },
    y: { grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 10 }, color: '#9CA3AF' }, beginAtZero: true },
  },
}

// â”€â”€â”€ KPICARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KpiCard({ label, value, sub, color = BRAND }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="font-serif text-2xl font-bold leading-none" style={{ color }}>{value ?? '—'}</div>
      <div className="text-gray-500 text-xs mt-1.5">{label}</div>
      {sub && <div className="text-xs mt-1 font-semibold" style={{ color }}>{sub}</div>}
    </div>
  )
}

// â”€â”€â”€ CHART CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ChartCard({ title, height = 190, canvasRef, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="font-serif text-sm font-bold mb-3">{title}</div>
      {children || <div style={{ height, position: 'relative' }}><canvas ref={canvasRef} /></div>}
    </div>
  )
}

// â”€â”€â”€ PERSONAL TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PersonalTab({ stats }) {
  const genRef = useRef(null)
  const gen2Ref = useRef(null)
  const uenRef = useRef(null)
  const antRef = useRef(null)
  const areaRef = useRef(null)

  useEffect(() => {
    if (!stats || !genRef.current) return
    const c = new Chart(genRef.current, {
      type: 'bar',
      data: {
        labels: ['Gen Zn(94-10)', 'Millennialsn(81-93)', 'Gen Xn(69-80)', 'Baby Boomn(49-68)'],
        datasets: [{ data: stats.genPct, backgroundColor: '#EA580C', borderRadius: 5, borderSkipped: false }],
      },
      options: { ...BASE_OPTS, plugins: { ...BASE_OPTS.plugins, tooltip: { callbacks: { label: c => c.parsed.y+'%' } } } },
    })
    return () => c.destroy()
  }, [stats])

  useEffect(() => {
    if (!stats || !gen2Ref.current) return
    const labels = Object.keys(stats.generoMap)
    const data = Object.values(stats.generoMap)
    const c = new Chart(gen2Ref.current, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: [BRAND, '#EA580C'], borderWidth: 0, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 10, padding: 8 } } } },
    })
    return () => c.destroy()
  }, [stats])

  useEffect(() => {
    if (!stats || !uenRef.current) return
    const labels = Object.keys(stats.uenMap)
    const data = Object.values(stats.uenMap)
    const c = new Chart(uenRef.current, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 9 }, boxWidth: 8, padding: 5 } } } },
    })
    return () => c.destroy()
  }, [stats])

  useEffect(() => {
    if (!stats || !antRef.current) return
    const labels = Object.keys(stats.antigMap)
    const data = Object.values(stats.antigMap)
    const c = new Chart(antRef.current, {
      type: 'bar',
      data: { labels, datasets: [{ data, backgroundColor: '#EA580C', borderRadius: 5, borderSkipped: false }] },
      options: BASE_OPTS,
    })
    return () => c.destroy()
  }, [stats])

  useEffect(() => {
    if (!stats || !areaRef.current) return
    const sorted = Object.entries(stats.deptMap).sort((a,b) => b[1]-a[1]).slice(0, 8)
    const c = new Chart(areaRef.current, {
      type: 'bar',
      data: { labels: sorted.map(([l]) => l), datasets: [{ data: sorted.map(([,v]) => v), backgroundColor: BRAND, borderRadius: 4, borderSkipped: false }] },
      options: { ...BASE_OPTS, indexAxis: 'y' },
    })
    return () => c.destroy()
  }, [stats])

  if (!stats) return <div className="text-gray-400 text-sm py-12 text-center">Cargando datos...</div>

  return (
    <div>
      {/* KPIs Power-BI style */}
      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: '180px 1fr 1fr' }}>
        <div className="flex flex-col gap-3">
          {[
            { label: 'Headcount activo', value: stats.headcount, bg: BRAND },
            { label: '% ingresos 2025', value: stats.pctIngr2025+'%', bg: '#EA580C' },
            { label: '% ingresos 2026', value: stats.pctIngr2026+'%', bg: '#EA580C' },
            { label: 'Prom. antigüedad (años)', value: stats.avgAntig, bg: '#0F766E' },
            { label: 'Prom. edad (años)', value: stats.avgEdad, bg: '#0F766E' },
          ].map(({ label, value, bg }) => (
            <div key={label} className="rounded-xl p-3.5" style={{ background: bg }}>
              <div className="font-serif text-2xl font-bold text-white leading-none">{value ?? '—'}</div>
              <div className="text-white/60 text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>
        <ChartCard title="Generaciones Areya"><div style={{ height: 190, position: 'relative' }}><canvas ref={genRef} /></div></ChartCard>
        <ChartCard title="Género"><div style={{ height: 190, position: 'relative' }}><canvas ref={gen2Ref} /></div></ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <ChartCard title="Headcount por UEN"><div style={{ height: 190, position: 'relative' }}><canvas ref={uenRef} /></div></ChartCard>
        <ChartCard title="Antigüedad en la empresa"><div style={{ height: 190, position: 'relative' }}><canvas ref={antRef} /></div></ChartCard>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 text-center">
          <div className="font-serif text-sm font-bold mb-2">Menos de 6 meses</div>
          <div className="font-serif text-4xl font-bold" style={{ color: '#F59E0B' }}>{stats.menos6m}</div>
          <div className="text-gray-400 text-xs mt-1">colaboradores</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 text-center">
          <div className="font-serif text-sm font-bold mb-2">Más de 6 meses</div>
          <div className="font-serif text-4xl font-bold" style={{ color: '#10B981' }}>{stats.mas6m}</div>
          <div className="text-gray-400 text-xs mt-1">colaboradores</div>
        </div>
        <ChartCard title="Distribución por área"><div style={{ height: 150, position: 'relative' }}><canvas ref={areaRef} /></div></ChartCard>
      </div>
    </div>
  )
}

// â”€â”€â”€ FINANZAS TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FinanzasTab({ stats }) {
  const distRef = useRef(null)

  useEffect(() => {
    if (!stats || !distRef.current || !stats.distPct.length) return
    const c = new Chart(distRef.current, {
      type: 'doughnut',
      data: {
        labels: stats.distPct.map(d => d.l),
        datasets: [{ data: stats.distPct.map(d => d.v), backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 4 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 10, padding: 6 } } } },
    })
    return () => c.destroy()
  }, [stats])

  if (!stats) return <div className="text-gray-400 text-sm py-12 text-center">Cargando datos...</div>

  const active = stats.activos_ob_list || []

  return (
    <div>
      {/* Totales */}
      <div className="rounded-xl p-5 text-white mb-5 grid grid-cols-3 gap-5" style={{ background: 'linear-gradient(135deg, #1A1A2E, #2D4BFF)' }}>
        {[
          { label: 'Costo total mensual', value: fmt(stats.costoTotal) },
          { label: 'Costo total anual', value: fmt(stats.costoAnual) },
          { label: 'Costo promedio / empleado / mes', value: fmt(Math.round(stats.promCosto)) },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="font-serif text-2xl font-bold">{value}</div>
            <div className="text-white/60 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <ChartCard title="Distribución de costos">
          <div style={{ height: 190, position: 'relative' }}><canvas ref={distRef} /></div>
        </ChartCard>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="font-serif text-sm font-bold mb-3">Top 5 por costo real mensual</div>
          <div className="flex flex-col gap-2">
            {[...active].sort((a,b) => (b.costo_real_mens||0)-(a.costo_real_mens||0)).slice(0,5).map(e => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate max-w-48">{e.nombre_completo || '—'}</span>
                <span className="font-bold text-emerald-600 ml-2 flex-shrink-0">{fmt(e.costo_real_mens)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="font-serif text-sm font-bold mb-3">Desglose por colaborador</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {['Colaborador','Sueldo bruto','Beneficios','Costo real/mes','Costo real/año'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap border-b border-gray-100">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map(e => {
                const benef = (e.despensa||0)+(e.fondo_ahorro||0)+(e.gasolina||0)+(e.prima_vacacional||0)+(e.monto_celular||0)+(e.sgmm||0)+(e.seguro_vida||0)+(e.mant_auto||0)
                return (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-gray-800">{e.nombre_completo}</div>
                      <div className="text-gray-400">{e['Puesto']}</div>
                    </td>
                    <td className="px-3 py-2.5">{fmt(e.sueldo_bruto)}</td>
                    <td className="px-3 py-2.5">{fmt(benef)}</td>
                    <td className="px-3 py-2.5 font-bold" style={{ color: ACCENT }}>{fmt(e.costo_real_mens)}</td>
                    <td className="px-3 py-2.5">{fmt(e.costo_real_anual)}</td>
                  </tr>
                )
              })}
              {active.length === 0 && (
                <tr><td colSpan={5} className="text-center py-6 text-gray-400">Sin datos de compensación en el master</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// â”€â”€â”€ ATTRITION TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AttritionTab({ stats }) {
  const motivosRef = useRef(null)
  const bajasRef = useRef(null)
  const bajasDeptRef = useRef(null)

  useEffect(() => {
    if (!stats || !motivosRef.current) return
    const entries = Object.entries(stats.motivoMap)
    const c = new Chart(motivosRef.current, {
      type: 'doughnut',
      data: { labels: entries.map(([l]) => l), datasets: [{ data: entries.map(([,v]) => v), backgroundColor: CHART_COLORS, borderWidth: 0, hoverOffset: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 10 }, boxWidth: 10, padding: 6 } } } },
    })
    return () => c.destroy()
  }, [stats])

  useEffect(() => {
    if (!stats || !bajasRef.current) return
    const c = new Chart(bajasRef.current, {
      type: 'bar',
      data: { labels: MESES, datasets: [{ data: stats.bajasMes, backgroundColor: 'rgba(239,68,68,.8)', borderRadius: 4, borderSkipped: false }] },
      options: BASE_OPTS,
    })
    return () => c.destroy()
  }, [stats])

  useEffect(() => {
    if (!stats || !bajasDeptRef.current) return
    const entries = Object.entries(stats.bajasDeptMap)
    const c = new Chart(bajasDeptRef.current, {
      type: 'bar',
      data: { labels: entries.map(([l]) => l), datasets: [{ data: entries.map(([,v]) => v), backgroundColor: 'rgba(239,68,68,.7)', borderRadius: 4, borderSkipped: false }] },
      options: { ...BASE_OPTS, indexAxis: 'y' },
    })
    return () => c.destroy()
  }, [stats])

  if (!stats) return <div className="text-gray-400 text-sm py-12 text-center">Cargando datos...</div>

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="Bajas este año" value={stats.bajasAnio} color="#EF4444" />
        <KpiCard label="Tasa de rotación" value={stats.tasaRot + '%'} color="#F59E0B" sub="Prom. industria: 8%" />
        <KpiCard label="Antigüedad prom. al salir" value={stats.avgAntigSalida + ' años'} color="#10B981" />
        <KpiCard label="Offboardings activos" value={stats.offboarding} color={ACCENT} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <ChartCard title="Motivos de salida"><div style={{ height: 190, position: 'relative' }}><canvas ref={motivosRef} /></div></ChartCard>
        <ChartCard title="Bajas por mes"><div style={{ height: 190, position: 'relative' }}><canvas ref={bajasRef} /></div></ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Bajas por área"><div style={{ height: 180, position: 'relative' }}><canvas ref={bajasDeptRef} /></div></ChartCard>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="font-serif text-sm font-bold mb-3">Historial de bajas</div>
          {stats.inactivos_list.length === 0
            ? <div className="text-gray-400 text-sm text-center py-6">Sin bajas registradas</div>
            : stats.inactivos_list.map(e => (
              <div key={e.id} className="flex items-start justify-between py-2.5 border-b border-gray-50 last:border-0 text-sm">
                <div>
                  <div className="font-semibold">{e.nombre_completo}</div>
                  <div className="text-gray-400 text-xs">{e.departamento} · {fmtDate(e.fecha_termino)}</div>
                </div>
                <span className="text-xs text-red-600 font-medium ml-2 flex-shrink-0">{e.razon_termino || '—'}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// â”€â”€â”€ ONBOARDING TAB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OnboardingTabDash({ stats }) {
  if (!stats) return <div className="text-gray-400 text-sm py-12 text-center">Cargando datos...</div>
  const active = stats.activos_ob_list.filter(e => e.status === 'Onboarding')
  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <KpiCard label="En proceso" value={stats.onboarding} color={ACCENT} />
        <KpiCard label="En offboarding" value={stats.offboarding} color="#F59E0B" />
        <KpiCard label="Total activos" value={stats.headcount} color="#10B981" />
        <KpiCard label="Total headcount" value={stats.total} color={BRAND} />
      </div>
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="font-serif text-sm font-bold mb-3">Empleados en onboarding</div>
        {active.length === 0
          ? <div className="text-gray-400 text-sm text-center py-6">No hay colaboradores en onboarding actualmente</div>
          : active.map(e => (
            <div key={e.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: ACCENT }}>
                {(e.nombre_completo||'?').split(' ').slice(0,2).map(w=>w[0]).join('')}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{e.nombre_completo}</div>
                    <div className="text-xs text-gray-400">{e['Puesto']} · {e.departamento}</div>
              </div>
              <div className="text-xs text-gray-400">Ingreso: {fmtDate(e.fecha_ingreso)}</div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">Onboarding</span>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// â”€â”€â”€ DASHBOARD PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DashboardPage({ stats, empleados, pendingAdmins, onApproveAdmin, dashTab, setDashTab }) {
  const tabs = [
    { id: 'personal', label: 'Personal' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'finanzas', label: 'Finanzas' },
    { id: 'attrition', label: 'Attrition' },
  ]

  const exportDashboard = () => {
    if (!stats) return
    exportWorkbook('reporte_dashboard_rrhh.xlsx', [
      {
        name: 'Resumen',
        rows: [
          { indicador: 'Headcount activo', valor: stats.headcount },
          { indicador: 'En onboarding', valor: stats.onboarding },
          { indicador: 'En offboarding', valor: stats.offboarding },
          { indicador: 'Total colaboradores', valor: stats.total },
          { indicador: 'Bajas del año', valor: stats.bajasAnio },
          { indicador: 'Tasa de rotacion', valor: stats.tasaRot },
          { indicador: 'Costo total mensual', valor: stats.costoTotal },
          { indicador: 'Costo total anual', valor: stats.costoAnual },
        ],
      },
      {
        name: 'Plantilla',
        rows: empleados.map(e => ({
          nombre: e.nombre_completo,
          status: e.status,
          departamento: e.departamento,
          'Puesto': e['Puesto'],
          fecha_ingreso: e.fecha_ingreso,
          fecha_termino: e.fecha_termino,
          razon_termino: e.razon_termino,
        })),
      },
    ])
  }

  return (
    <div>
      {/* Pending admin requests */}
      {pendingAdmins.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="font-semibold text-sm text-amber-800 mb-2">
            🔔 {pendingAdmins.length} solicitud{pendingAdmins.length > 1 ? 'es' : ''} de acceso al panel
          </div>
          {pendingAdmins.map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-t border-amber-200">
              <span className="text-sm font-mono text-amber-900">{r.email}</span>
              <button onClick={() => onApproveAdmin(r.id, r.email)}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
                style={{ background: '#10B981', color: '#fff' }}>
                ✓ Aprobar acceso
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex gap-1.5 bg-gray-100 rounded-xl p-1 w-fit">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setDashTab(t.id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${dashTab === t.id ? 'bg-white text-brand shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
              style={dashTab === t.id ? { color: BRAND } : {}}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={exportDashboard} className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
          Descargar reporte
        </button>
      </div>

      {dashTab === 'personal' && <PersonalTab stats={stats} />}
      {dashTab === 'onboarding' && <OnboardingTabDash stats={stats} />}
      {dashTab === 'finanzas' && <FinanzasTab stats={stats} />}
      {dashTab === 'attrition' && <AttritionTab stats={stats} />}
    </div>
  )
}

// â”€â”€â”€ MASTER TABLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MasterTable({ empleados, search, setSearch, statusFilter, setStatusFilter, loading, onLoad, showToast }) {
  const columns = [
    // Identificación
    { key: 'uen', label: 'UEN', render: e => e.uen || '—' },
    { key: 'ID Colaborador', label: 'ID Colab.', render: e => e['ID Colaborador'] || '—', className: 'text-xs text-gray-400 font-mono' },
    { key: 'status', label: 'Status', render: e => <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_CLS[e.status] || 'bg-gray-100 text-gray-500'}`}>{e.status}</span> },
    { key: 'nombre_completo', label: 'Nombre completo', render: e => e.nombre_completo || '—', className: 'font-semibold whitespace-nowrap', style: { color: ACCENT } },
    { key: 'nombre', label: 'Nombre(s)', render: e => e.nombre || '—' },
    { key: 'ap_pat', label: 'Ap. Paterno', render: e => e.ap_pat || '—' },
    { key: 'ap_mat', label: 'Ap. Materno', render: e => e.ap_mat || '—' },
    // Datos personales
    { key: 'fecha_nac', label: 'Fecha Nacim.', render: e => fmtDate(e.fecha_nac), className: 'text-xs text-gray-500 whitespace-nowrap' },
    { key: 'genero', label: 'Género', render: e => e.genero || '—' },
    { key: 'estado_civil', label: 'Estado civil', render: e => e.estado_civil || '—' },
    { key: 'nacionalidad', label: 'Nacionalidad', render: e => e.nacionalidad || '—' },
    { key: 'rfc', label: 'RFC', render: e => e.rfc || '—', className: 'font-mono text-xs' },
    { key: 'curp', label: 'CURP', render: e => e.curp || '—', className: 'font-mono text-xs' },
    { key: 'nss', label: 'NSS', render: e => e.nss || '—', className: 'font-mono text-xs' },
    { key: 'direccion', label: 'Dirección', render: e => e.direccion || '—', className: 'text-xs max-w-36 truncate' },
    { key: 'municipio', label: 'Municipio', render: e => e.municipio || '—' },
    // Empleo
    { key: 'fecha_ingreso', label: 'Fecha ingreso', render: e => fmtDate(e.fecha_ingreso), className: 'text-xs text-gray-500 whitespace-nowrap' },
    { key: 'departamento', label: 'Departamento', render: e => e.departamento || '—' },
    { key: 'Puesto', label: 'Cargo', render: e => e['Puesto'] || '—', className: 'max-w-36 truncate' },
    { key: 'Tipo de contratación', label: 'Tipo contrato', render: e => e['Tipo de contratación'] || '—' },
    { key: 'jefe_directo', label: 'Jefe directo', render: e => e.jefe_directo || '—' },
    { key: 'email_corporativo', label: 'Email corporativo', render: e => e.email_corporativo || '—', className: 'font-mono text-xs', style: { color: ACCENT } },
    { key: 'email_personal', label: 'Email personal', render: e => e.email_personal || '—', className: 'font-mono text-xs' },
    { key: 'fecha_termino', label: 'Fecha término', render: e => fmtDate(e.fecha_termino), className: 'text-xs text-gray-500 whitespace-nowrap' },
    { key: 'razon_termino', label: 'Razón término', render: e => e.razon_termino || '—', className: 'text-xs' },
    // Tabulador (fondo azul claro)
    { key: 'antiguedad', label: 'Antigüedad', render: e => e.antiguedad || '—', className: 'text-xs', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'razon_social', label: 'Razón social', render: e => e.razon_social || '—', className: 'text-xs', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'familia_puesto', label: 'Familia puesto', render: e => e.familia_puesto || '—', className: 'text-xs', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'nivel_tab', label: 'Nivel', render: e => e.nivel_tab ?? '—', className: 'text-xs', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'gente_a_cargo', label: 'Gente a cargo', render: e => e.gente_a_cargo ?? '—', className: 'text-xs text-center', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'rango_sueldo', label: 'Rango sueldo', render: e => e.rango_sueldo || '—', className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'punto_medio', label: 'Punto medio', render: e => fmt(e.punto_medio), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'dif_pct', label: 'Dif. %', render: e => e.dif_pct != null ? `${e.dif_pct > 0 ? '+' : ''}${e.dif_pct}%` : '—', className: 'text-xs', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'dif_pesos', label: 'Dif. $', render: e => fmt(e.dif_pesos), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'sueldo_bruto', label: 'Sueldo bruto', render: e => fmt(e.sueldo_bruto), className: 'text-xs font-semibold whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'sueldo_neto', label: 'Sueldo neto', render: e => fmt(e.sueldo_neto), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'gasolina', label: 'Gasolina', render: e => fmt(e.gasolina), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'despensa', label: 'Despensa 12%', render: e => fmt(e.despensa), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'fondo_ahorro', label: 'Fondo ahorro', render: e => fmt(e.fondo_ahorro), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'meses_bono', label: 'Meses bono', render: e => e.meses_bono ?? '—', className: 'text-xs text-center', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'pct_prima', label: '% Prima', render: e => e.pct_prima != null ? `${e.pct_prima}%` : '—', className: 'text-xs text-center', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'prima_vacacional', label: 'Prima vacacional', render: e => fmt(e.prima_vacacional), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'mant_auto', label: 'Mant. auto', render: e => fmt(e.mant_auto), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'monto_celular', label: 'Monto celular', render: e => fmt(e.monto_celular), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'celular', label: 'Celular', render: e => e.celular || '—', className: 'text-xs text-center', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'sgmm', label: 'SGMM', render: e => fmt(e.sgmm), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'seguro_vida', label: 'Seguro vida', render: e => fmt(e.seguro_vida), className: 'text-xs whitespace-nowrap', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    { key: 'comentarios', label: 'Comentarios', render: e => e.comentarios || '—', className: 'text-xs max-w-40 truncate', thStyle: { background: '#EEF2FF', color: '#3730A3' }, tdStyle: { background: '#F5F3FF' } },
    // Costo real (fondo verde)
    { key: 'costo_real_mens', label: 'Costo real/mes', render: e => fmt(e.costo_real_mens), className: 'text-xs font-bold whitespace-nowrap', thStyle: { background: '#D1FAE5', color: '#065F46' }, tdStyle: { background: '#ECFDF5', color: '#047857' } },
    { key: 'costo_real_anual', label: 'Costo real/año', render: e => fmt(e.costo_real_anual), className: 'text-xs font-bold whitespace-nowrap', thStyle: { background: '#D1FAE5', color: '#065F46' }, tdStyle: { background: '#ECFDF5', color: '#047857' } },
  ]

  const filtered = empleados.filter(e => {
    const q = search.toLowerCase()
    const match = !q || [
      e.nombre_completo, e.rfc, e.curp, e.nss, e.email_corporativo, e['ID Colaborador'], e.departamento, e['Puesto'],
    ].some(value => (value || '').toString().toLowerCase().includes(q))
    const st = !statusFilter || e.status === statusFilter
    return match && st
  })

  const exportMaster = () => {
    exportWorkbook('master_empleados.xlsx', [
      {
        name: 'Master',
        rows: filtered.map(e => ({
          uen: e.uen, 'ID Colaborador': e['ID Colaborador'], status: e.status,
          nombre_completo: e.nombre_completo, nombre: e.nombre, ap_pat: e.ap_pat, ap_mat: e.ap_mat,
          fecha_nac: e.fecha_nac, genero: e.genero, estado_civil: e.estado_civil, nacionalidad: e.nacionalidad,
          rfc: e.rfc, curp: e.curp, nss: e.nss, direccion: e.direccion, municipio: e.municipio,
          fecha_ingreso: e.fecha_ingreso, departamento: e.departamento, 'Puesto': e['Puesto'],
          'Tipo de contratación': e['Tipo de contratación'], jefe_directo: e.jefe_directo,
          email_corporativo: e.email_corporativo, email_personal: e.email_personal,
          fecha_termino: e.fecha_termino, razon_termino: e.razon_termino,
          antiguedad: e.antiguedad, razon_social: e.razon_social, familia_puesto: e.familia_puesto,
          nivel_tab: e.nivel_tab, gente_a_cargo: e.gente_a_cargo, rango_sueldo: e.rango_sueldo,
          punto_medio: e.punto_medio, dif_pct: e.dif_pct, dif_pesos: e.dif_pesos,
          sueldo_bruto: e.sueldo_bruto, sueldo_neto: e.sueldo_neto,
          gasolina: e.gasolina, despensa: e.despensa, fondo_ahorro: e.fondo_ahorro,
          meses_bono: e.meses_bono, pct_prima: e.pct_prima, prima_vacacional: e.prima_vacacional,
          mant_auto: e.mant_auto, monto_celular: e.monto_celular, celular: e.celular,
          sgmm: e.sgmm, seguro_vida: e.seguro_vida, comentarios: e.comentarios,
          costo_real_mens: e.costo_real_mens, costo_real_anual: e.costo_real_anual,
        })),
      },
    ])
  }

  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="text" placeholder="Buscar nombre, RFC, CURP, NSS, ID o email..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none">
          <option value="">Todos los estatus</option>
          {['Pendiente','Activo','Onboarding','Offboarding','Inactivo'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button onClick={exportMaster} className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">Descargar Excel</button>
        <button onClick={onLoad} className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">↻ Actualizar</button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {columns.map(col => (
                  <th key={col.key} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap" style={col.thStyle || { color: '#9CA3AF' }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={columns.length} className="text-center py-10 text-gray-400">Cargando...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={columns.length} className="text-center py-10 text-gray-400">
                  {empleados.length === 0 ? 'No hay registros. Importa el master para comenzar.' : 'Sin resultados para esa búsqueda.'}
                </td></tr>
              )}
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className={`px-3 py-2.5 ${col.className || 'text-gray-600'}`} style={{ ...(col.style || {}), ...(col.tdStyle || {}) }}>
                      {col.render(e)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
          {filtered.length} de {empleados.length} colaboradores
        </div>
      </div>
    </div>
  )
}

// â”€â”€â”€ IMPORT PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ImportPage({ importTab, setImportTab, importData, setImportData, importLog, setImportLog, importing, onProcess, onRun, onDownloadTemplate }) {
  const [dragOver, setDragOver] = useState(false)
  const previewRow = Array.isArray(importData?.rows)
    ? importData.rows.find(row => row && typeof row === 'object' && !Array.isArray(row))
    : null
  const previewColumns = previewRow ? Object.keys(previewRow) : []

  const renderPreviewValue = value => {
    if (value == null) return ''
    if (value instanceof Date) return value.toLocaleDateString('es-MX')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const handleDrop = event => {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer?.files?.[0]
    if (file) onProcess(file, importTab)
  }

  return (
    <div className="max-w-2xl">
      <div className="flex gap-2 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {['master', 'tareas'].map(t => (
          <button key={t} onClick={() => { setImportTab(t); setImportData(null); setImportLog(null) }}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${importTab === t ? 'bg-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
            style={importTab === t ? { color: BRAND } : {}}>
            {t === 'master' ? 'Master / Tabulador' : 'Plantilla de tareas'}
          </button>
        ))}
      </div>

      <div className={`bg-white rounded-xl shadow-sm p-4 mb-4 border-l-4 ${importTab === 'master' ? 'border-indigo-500' : 'border-purple-500'}`}>
        {importTab === 'master' ? (
          <div className="text-sm text-gray-600">
            <strong className="text-gray-800">Importación selectiva:</strong>{' '}
            <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs">ID Colaborador</code> para master y/o{' '}
            <code className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-xs">Nivel</code> para tabulador.
            <span className="text-xs text-gray-500 block mt-1">Solo actualiza los campos presentes en el archivo. Los vacíos no borran información.</span>
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            Columnas: {['nivel','categoria','titulo','descripcion','orden'].map(c => (
              <code key={c} className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-xs mr-1">{c}</code>
            ))}
            <button onClick={onDownloadTemplate} className="block text-xs text-purple-600 underline mt-1">⬇ Descargar plantilla</button>
          </div>
        )}
      </div>

      {!importData && !importLog && (
        <label
          onDragOver={event => { event.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver ? 'border-indigo-400 bg-indigo-50/70' : 'border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50'
          }`}
        >
          <div className="text-3xl mb-3">📂</div>
          <div className="text-sm font-semibold text-gray-700 mb-1">{dragOver ? 'Suelta el archivo aquí' : 'Arrastra o haz clic para subir'}</div>
          <div className="text-xs text-gray-400">.xlsx · .xls · .csv</div>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => e.target.files[0] && onProcess(e.target.files[0], importTab)} />
        </label>
      )}

      {importData && !importLog && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="font-serif text-sm font-bold mb-3">{importData.fileName}</div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[{ n: importData.rows.length, l: 'Total filas' },{ n: previewColumns.length, l: 'Columnas' },{ n: importData.type==='master'?'UPSERT':'Tareas', l: 'Modo' }].map((s,i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="font-serif text-xl font-bold" style={{ color: ACCENT }}>{s.n}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-100 mb-4">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  {previewColumns.map(h => <th key={h} className="px-3 py-2 text-left font-bold text-gray-400 whitespace-nowrap border-b border-gray-100">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {importData.rows.slice(0,5).map((r,i) => (
                  <tr key={i} className="border-b border-gray-50">
                    {previewColumns.map(h => <td key={h} className="px-3 py-2 whitespace-nowrap max-w-32 truncate">{renderPreviewValue(r?.[h])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setImportData(null)} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50">Cancelar</button>
            <button onClick={onRun} disabled={importing}
              className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-50"
              style={{ background: ACCENT }}>
              {importing ? 'Importando...' : `Importar ${importData.rows.length} filas →`}
            </button>
          </div>
        </div>
      )}

      {importLog && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="font-serif text-sm font-bold mb-3">Resultado</div>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[{ n: importLog.inserted, l: 'Master nuevos', c: ACCENT },{ n: importLog.updated, l: 'Master actualizados', c: '#10B981' },{ n: importLog.tabInserted || 0, l: 'Tabulador nuevos', c: '#7C3AED' },{ n: importLog.tabUpdated || 0, l: 'Tabulador actualizados', c: '#0891B2' },{ n: importLog.skipped, l: 'Omitidos', c: importLog.skipped ? '#EF4444' : '#9CA3AF' }].map((s,i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="font-serif text-2xl font-bold" style={{ color: s.c }}>{s.n}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed">
            {importLog.lines.map((l,i) => (
              <div key={i} className={l.startsWith('✓')||l.startsWith('+') ? 'text-emerald-700' : l.startsWith('⚠') ? 'text-amber-600' : 'text-red-600'}>{l}</div>
            ))}
          </div>
          <button onClick={() => { setImportData(null); setImportLog(null) }}
            className="mt-3 w-full py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
            Nueva importación
          </button>
        </div>
      )}
    </div>
  )
}

// â”€â”€â”€ ONBOARDING PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OnboardingPageAdmin({ empleados, onLoad }) {
  const [tab, setTab] = useState('pendientes')
  const [modal, setModal] = useState(null)
  const [cfg, setCfg] = useState({ email_corporativo: '', nivel_tab: '', uen: '', razon_social: '' })
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }
  const pendientes = empleados.filter(e => e.status === 'Pendiente')
  const configurados = empleados.filter(e => e.onboarding_configurado)
  const enOB = empleados.filter(e => e.status === 'Onboarding')

  const openModal = (empleado) => {
    setModal(empleado)
    setCfg({
      email_corporativo: empleado.email_corporativo || '',
      nivel_tab: empleado.nivel_tab || '',
      uen: empleado.uen || '',
      razon_social: empleado.razon_social || '',
    })
  }

  const handleConfigurar = async () => {
    if (!cfg.email_corporativo || cfg.nivel_tab === '') {
      showToast('Asigna correo corporativo y nivel')
      return
    }
    setSaving(true)
    try {
      const comp = calcCompensacion(Number(cfg.nivel_tab))
      const empleadoData = {
        email_corporativo: cfg.email_corporativo.trim().toLowerCase(),
        nivel_tab: Number(cfg.nivel_tab),
        uen: cfg.uen,
        razon_social: cfg.razon_social,
        status: 'Onboarding',
        ...comp,
      }

      const result = await configurarNuevoIngreso(modal.id, empleadoData)
      const access = result.access

      try {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'welcome_empleado',
            data: {
              nombre: modal.nombre,
              email_corporativo: cfg.email_corporativo.trim().toLowerCase(),
              cargo: modal['Puesto'],
              departamento: modal.departamento,
              activation_link: `https://areya-red.vercel.app/portal?token=${access.token_activacion}`,
            },
          }),
        })
      } catch {}

      showToast(`Onboarding configurado y acceso enviado a ${cfg.email_corporativo}`)
      setModal(null)
      onLoad?.()
    } catch (e) {
      showToast('Error al configurar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const tabBtn = (id, label, count) => (
    <button onClick={() => setTab(id)}
      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-white shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
      style={tab === id ? { color: BRAND } : {}}>
      {label}
      {count > 0 && (
        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === id ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>{count}</span>
      )}
    </button>
  )

  return (
    <div>
      <div className="flex gap-1.5 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {tabBtn('pendientes', 'Pendientes de configurar', pendientes.length)}
        {tabBtn('en_proceso', 'En proceso', enOB.length)}
        {tabBtn('configurados', 'Configurados', configurados.length)}
      </div>

      {tab === 'pendientes' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {pendientes.length === 0
            ? <div className="text-center py-10 text-gray-400 text-sm">Sin formularios pendientes</div>
            : pendientes.map(n => (
                <div key={n.id} className="flex items-center gap-4 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#F59E0B' }}>
                    {(n.nombre_completo || '?').split(' ').slice(0,2).map(w => w[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{n.nombre_completo}</div>
                    <div className="text-xs text-gray-400">{n['Puesto']} · {n.departamento}</div>
                    <div className="text-xs text-gray-400 font-mono">{n.email_personal}</div>
                  </div>
                  <div className="text-xs text-gray-400 text-right mr-3">
                    <div>Ingreso: {fmtDate(n.fecha_ingreso)}</div>
                    <div>{n['Tipo de contratación']}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold mr-3">Pendiente</span>
                  <button onClick={() => openModal(n)}
                    className="px-4 py-2 text-sm font-semibold rounded-lg text-white transition-all flex-shrink-0"
                    style={{ background: ACCENT }}>
                    Configurar
                  </button>
                </div>
              ))
          }
        </div>
      )}

      {tab === 'en_proceso' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {enOB.length === 0
            ? <div className="text-center py-10 text-gray-400 text-sm">No hay colaboradores en onboarding actualmente</div>
            : enOB.map(e => (
                <div key={e.id} className="flex items-center gap-4 p-4 border-b border-gray-50 last:border-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: ACCENT }}>
                    {(e.nombre_completo || '?').split(' ').slice(0,2).map(w => w[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{e.nombre_completo}</div>
                    <div className="text-xs text-gray-400">{e['Puesto']} · {e.departamento}</div>
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    <div>Ingreso: {fmtDate(e.fecha_ingreso)}</div>
                    <div className="font-mono" style={{ color: ACCENT }}>{e.email_corporativo || '—'}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold">Onboarding</span>
                </div>
              ))
          }
        </div>
      )}

      {tab === 'configurados' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {configurados.length === 0
            ? <div className="text-center py-10 text-gray-400 text-sm">Sin registros configurados aún</div>
            : configurados.map(n => (
                <div key={n.id} className="flex items-center gap-4 p-4 border-b border-gray-50 last:border-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#10B981' }}>
                    {(n.nombre_completo || '?').split(' ').slice(0,2).map(w => w[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{n.nombre_completo}</div>
                    <div className="text-xs text-gray-400">{n['Puesto']} · {n.departamento}</div>
                  </div>
                  <div className="text-xs font-mono" style={{ color: ACCENT }}>{n.email_corporativo || '—'}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">Configurado</span>
                </div>
              ))
          }
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 pt-6 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <div className="font-serif text-lg font-bold">Configurar onboarding</div>
                <div className="text-sm text-gray-500 mt-0.5">{modal.nombre_completo}</div>
              </div>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">x</button>
            </div>

            <div className="px-6 py-4">
              <div className="bg-gray-50 rounded-xl p-4 mb-4 grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Puesto', modal['Puesto']], ['Área', modal.departamento],
                  ['Tipo contrato', modal['Tipo de contratación']], ['Fecha ingreso', fmtDate(modal.fecha_ingreso)],
                  ['Correo personal', modal.email_personal], ['Jefe directo', modal.jefe_directo],
                ].map(([l, v]) => (
                  <div key={l}>
                    <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{l}</div>
                    <div className="font-semibold text-gray-800">{v || '—'}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Correo corporativo a asignar <span className="text-red-500">*</span>
                  </label>
                  <input type="email" value={cfg.email_corporativo}
                    onChange={e => setCfg(c => ({ ...c, email_corporativo: e.target.value }))}
                    placeholder="nombre.apellido@areya.com.mx"
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 font-mono" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Nivel de tabulador <span className="text-red-500">*</span>
                  </label>
                  <select value={cfg.nivel_tab} onChange={e => setCfg(c => ({ ...c, nivel_tab: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-indigo-500">
                    <option value="">— Seleccionar —</option>
                    {TABULADOR.map(t => (
                      <option key={t.n} value={t.n}>{t.n} · {t.f} (${t.ref.toLocaleString('es-MX')})</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">UEN</label>
                  <select value={cfg.uen} onChange={e => setCfg(c => ({ ...c, uen: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-indigo-500">
                    <option value="">— Seleccionar —</option>
                    {['Areya Viviendas','Área y ambientación','Areya Edificadora Industrial','Areya Desarrolladora Industrial','Areya Desarrollos Industriales'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Razón social</label>
                  <input value={cfg.razon_social} onChange={e => setCfg(c => ({ ...c, razon_social: e.target.value }))}
                    placeholder="Areya Edificadora Industrial S.A. de C.V."
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500" />
                </div>
              </div>

              {cfg.nivel_tab !== '' && (() => {
                const comp = calcCompensacion(Number(cfg.nivel_tab))
                return (
                  <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                    <div className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-2">Compensación auto-asignada del tabulador</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[
                        ['Sueldo bruto', fmt(comp.sueldo_bruto)],
                        ['Sueldo neto', fmt(comp.sueldo_neto)],
                        ['Costo real/mes', fmt(comp.costo_real_mens)],
                        ['Despensa', fmt(comp.despensa)],
                        ['Fondo ahorro', fmt(comp.fondo_ahorro)],
                        ['Prima vac.', fmt(comp.prima_vacacional)],
                      ].map(([l, v]) => (
                        <div key={l}>
                          <div className="text-indigo-400">{l}</div>
                          <div className="font-bold text-indigo-800">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setModal(null)} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleConfigurar} disabled={saving}
                className="px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-50"
                style={{ background: ACCENT }}>
                {saving ? 'Guardando...' : 'Crear onboarding y enviar correo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50">
          {toastMsg}
        </div>
      )}
    </div>
  )
}

function OffboardingPageAdmin({ entrevistas, onComplete }) {
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [form, setForm] = useState({
    tipo_salida: 'Voluntaria',
    subcategoria_salida: '',
    razon_rrhh: '',
    comentarios_rrhh: '',
    fecha_termino: new Date().toISOString().slice(0, 10),
    elegible_recontratacion: true,
  })

  const showToast = msg => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000) }

  const open = (entrevista) => {
    setSelected(entrevista)
    setForm({
      tipo_salida: entrevista.tipo_salida || 'Voluntaria',
      subcategoria_salida: entrevista.subcategoria_salida || '',
      razon_rrhh: entrevista.razon_rrhh || '',
      comentarios_rrhh: entrevista.comentarios_rrhh || '',
      fecha_termino: entrevista.fecha_termino || new Date().toISOString().slice(0, 10),
      elegible_recontratacion: entrevista.elegible_recontratacion ?? true,
    })
  }

  const handleSave = async () => {
    if (!form.tipo_salida || !form.subcategoria_salida) {
      showToast('Selecciona tipo y subcategoría de salida')
      return
    }
    setSaving(true)
    try {
      await completeOffboarding(selected.id, form)
      showToast('Offboarding completado')
      setSelected(null)
      onComplete?.()
    } catch (e) {
      showToast('Error al completar offboarding: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const options = OFFBOARDING_REASON_TYPES[form.tipo_salida] || []

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {entrevistas.length === 0
          ? <div className="text-center py-10 text-gray-400 text-sm">No hay offboardings pendientes</div>
          : entrevistas.map(item => (
              <div key={item.id} className="flex items-center gap-4 p-4 border-b border-gray-50 last:border-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: '#F59E0B' }}>
                  {(item.empleados?.nombre_completo || '?').split(' ').slice(0,2).map(w => w[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{item.empleados?.nombre_completo}</div>
                  <div className="text-xs text-gray-400">{item.empleados?.['Puesto']} · {item.empleados?.departamento}</div>
                  <div className="text-xs text-gray-400">Entrevista enviada: {fmtDate(item.submitted_at?.slice(0, 10))}</div>
                </div>
                <div className="text-xs text-gray-500 max-w-56">{item.motivo_salida || 'Sin motivo declarado'}</div>
                <button onClick={() => open(item)} className="px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ background: ACCENT }}>
                  Completar offboarding
                </button>
              </div>
            ))
        }
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-gray-100">
              <div>
                <div className="font-serif text-lg font-bold">Completar offboarding</div>
                <div className="text-sm text-gray-500 mt-0.5">{selected.empleados?.nombre_completo}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">x</button>
            </div>

            <div className="grid grid-cols-2 gap-6 px-6 py-5">
              <div className="bg-gray-50 rounded-xl p-4 text-sm">
                <div className="font-serif text-sm font-bold mb-3">Respuesta del colaborador</div>
                <div className="space-y-3">
                  <div><span className="text-gray-400 block text-xs uppercase font-semibold">Motivo declarado</span><span>{selected.motivo_salida || '—'}</span></div>
                  <div><span className="text-gray-400 block text-xs uppercase font-semibold">Tiempo en Areya</span><span>{selected.tiempo_empresa || '—'}</span></div>
                  <div><span className="text-gray-400 block text-xs uppercase font-semibold">Comentarios</span><span>{selected.comentarios_libres || '—'}</span></div>
                  <div><span className="text-gray-400 block text-xs uppercase font-semibold">Recomendaría Areya</span><span>{selected.recomendaria == null ? '—' : selected.recomendaria ? 'Sí' : 'No'}</span></div>
                  <div><span className="text-gray-400 block text-xs uppercase font-semibold">Regresaría</span><span>{selected.regresaria == null ? '—' : selected.regresaria ? 'Sí' : 'No'}</span></div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tipo de salida</label>
                    <select value={form.tipo_salida} onChange={e => setForm(f => ({ ...f, tipo_salida: e.target.value, subcategoria_salida: '' }))}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-indigo-500">
                      {Object.keys(OFFBOARDING_REASON_TYPES).map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fecha de término</label>
                    <input type="date" value={form.fecha_termino} onChange={e => setForm(f => ({ ...f, fecha_termino: e.target.value }))}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Subcategoría</label>
                  <select value={form.subcategoria_salida} onChange={e => setForm(f => ({ ...f, subcategoria_salida: e.target.value, razon_rrhh: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-indigo-500">
                    <option value="">— Seleccionar —</option>
                    {options.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Razón principal para dashboard</label>
                  <input value={form.razon_rrhh} onChange={e => setForm(f => ({ ...f, razon_rrhh: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500"
                    placeholder="Se usa en attrition" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Comentarios internos RRHH</label>
                  <textarea value={form.comentarios_rrhh} onChange={e => setForm(f => ({ ...f, comentarios_rrhh: e.target.value }))}
                    rows={5}
                    className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 resize-none" />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Elegible para recontratación</span>
                  <button onClick={() => setForm(f => ({ ...f, elegible_recontratacion: true }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${form.elegible_recontratacion ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                    Sí
                  </button>
                  <button onClick={() => setForm(f => ({ ...f, elegible_recontratacion: false }))}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${form.elegible_recontratacion === false ? 'bg-red-600 text-white border-red-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                    No
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button onClick={() => setSelected(null)} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm font-semibold rounded-lg text-white transition-all disabled:opacity-50"
                style={{ background: ACCENT }}>
                {saving ? 'Guardando...' : 'Cerrar offboarding'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50">
          {toastMsg}
        </div>
      )}
    </div>
  )
}
function TabuladorPage() {
  const [rows, setRows] = useState([])
  const [loadErr, setLoadErr] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getTabuladorRows()
        setRows(data || [])
        setLoadErr('')
      } catch {
        setRows([])
        setLoadErr('Aún no se ha cargado el tabulador desde Supabase.')
      }
    }
    load()
  }, [])

  const exportTabulador = () => {
    exportWorkbook('tabulador_puestos.xlsx', [
      {
        name: 'Tabulador',
        rows: (rows.length ? rows : TABULADOR.map(item => ({
          nivel: item.n,
          familia_puesto: item.f,
          [REF_COL]: item.ref,
          [LIM_INF_COL]: item.inf,
          [LIM_SUP_COL]: item.sup,
        }))),
      },
    ])
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 text-gray-500 text-sm">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="font-serif text-base font-bold text-gray-800">Tabulador actual</div>
        <button onClick={exportTabulador} className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 transition-all">
          Descargar Excel
        </button>
      </div>
      {loadErr && <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-amber-800">{loadErr}</div>}
      <div className="overflow-x-auto rounded-lg border border-gray-100">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50">
              {['Familia de puesto', 'Nivel', 'Referencia', 'Brinco', 'Límite inferior', 'Límite superior', 'Rango'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-bold text-gray-400 whitespace-nowrap border-b border-gray-100">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(rows.length ? rows : TABULADOR.map(item => ({
              familia_puesto: item.f,
              nivel: item.n,
              [REF_COL]: item.ref,
              brinco: item.b,
              [LIM_INF_COL]: item.inf,
              [LIM_SUP_COL]: item.sup,
              rango: `${item.inf} - ${item.sup}`,
            }))).map((row, index) => (
              <tr key={row.id || row.nivel || index} className="border-b border-gray-50">
                <td className="px-3 py-2">{row.familia_puesto || row.f || '—'}</td>
                <td className="px-3 py-2">{row.nivel ?? row.n ?? '—'}</td>
                <td className="px-3 py-2">{fmt(row[REF_COL] ?? row.ref)}</td>
                <td className="px-3 py-2">{row.brinco != null && row.brinco !== '' ? `${Math.round(Number(row.brinco))}%` : '—'}</td>
                <td className="px-3 py-2">{fmt(row[LIM_INF_COL] ?? row.inf)}</td>
                <td className="px-3 py-2">{fmt(row[LIM_SUP_COL] ?? row.sup)}</td>
                <td className="px-3 py-2">{row.rango || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// â”€â”€â”€ MAIN COMPONENT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Admin() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Login state â€” todos los hooks al nivel superior (no dentro de condicionales)
  const [loginStep, setLoginStep] = useState('email') // 'email' | 'password' | 'forgot' | 'reset' | 'pending'
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loginPassConfirm, setLoginPassConfirm] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loginMsg, setLoginMsg] = useState('')

  // App state
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [dashTab, setDashTab] = useState('personal')
  const [empleados, setEmpleados] = useState([])
  const [offboardingPendientes, setOffboardingPendientes] = useState([])
  const [pendingAdmins, setPendingAdmins] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')
  const [importTab, setImportTab] = useState('master')
  const [importData, setImportData] = useState(null)
  const [importLog, setImportLog] = useState(null)
  const [importing, setImporting] = useState(false)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return
    try {
      const session = JSON.parse(raw)
      if (session?.user) {
        setUser(session.user)
        if (session.page) setPage(session.page)
      }
    } catch {
      localStorage.removeItem(ADMIN_SESSION_KEY)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      localStorage.removeItem(ADMIN_SESSION_KEY)
      return
    }
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ user, page }))
  }, [user, page])

  useEffect(() => {
    if (!user) return
    loadEmpleados()
    loadOffboardingPendientes()
  }, [user])

  useEffect(() => {
    const resetToken = searchParams.get('reset')
    if (!resetToken || user) return

    const loadReset = async () => {
      try {
        const result = await adminAuth('lookup_reset', { token: resetToken })
        setLoginEmail(result.email || '')
        setLoginStep('reset')
        setLoginErr('')
      } catch (e) {
        setLoginErr(e.code === 'expired_token' ? 'El enlace de recuperación expiró.' : 'El enlace de recuperación no es válido.')
        setLoginStep('email')
      }
    }

    loadReset()
  }, [searchParams, user])

  useEffect(() => {
    if (!user || page !== 'dashboard') return
    loadPendingAdmins()
  }, [user, page])

  const loadEmpleados = async () => {
    setLoading(true)
    try { setEmpleados(await getEmpleados({})) }
    catch { showToast('Error al cargar empleados') }
    finally { setLoading(false) }
  }

  const loadPendingAdmins = async () => {
    try {
      const { data } = await supabase.from('solicitudes_admin').select('*').eq('status', 'pending').order('requested_at', { ascending: false })
      setPendingAdmins(data || [])
    } catch { /* tabla puede no existir aún */ }
  }

  const loadOffboardingPendientes = async () => {
    try { setOffboardingPendientes(await getEntrevistasSalidaPendientes()) }
    catch { setOffboardingPendientes([]) }
  }

  const approveAdminRequest = async (id, email) => {
    const normalizedEmail = email.trim().toLowerCase()
    const { data: existing } = await supabase
      .from('staff_rh')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('staff_rh')
        .update({
          status: 'Activo',
          approved_at: new Date().toISOString(),
          aprobado_por: user.id || null,
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('staff_rh').insert({
        nombre_completo: normalizedEmail,
        email: normalizedEmail,
        rol: 'Admin',
        status: 'Activo',
        approved_at: new Date().toISOString(),
        aprobado_por: user.id || null,
      })
    }

    await supabase
      .from('solicitudes_admin')
      .update({ status: 'approved', approved_by: user.name, approved_at: new Date().toISOString() })
      .eq('id', id)

    showToast(`Acceso aprobado para ${email}`)
    loadPendingAdmins()
  }

  // â”€â”€ COMPUTED STATS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const stats = useMemo(() => {
    if (!empleados.length) return null
    const now = new Date()
    const currentYear = now.getFullYear()

    const activos = empleados.filter(e => e.status === 'Activo')
    const onboarding = empleados.filter(e => e.status === 'Onboarding')
    const offboarding = empleados.filter(e => e.status === 'Offboarding')
    const inactivos = empleados.filter(e => e.status === 'Inactivo')
    const activos_ob = [...activos, ...onboarding]
    const total = empleados.length

    const pctIngr2025 = total ? Math.round(empleados.filter(e => e.fecha_ingreso?.startsWith('2025')).length / total * 100) : 0
    const pctIngr2026 = total ? +(empleados.filter(e => e.fecha_ingreso?.startsWith('2026')).length / total * 100).toFixed(2) : 0

    const avgArr = (arr, fn) => {
      const vals = arr.map(fn).filter(v => v > 0)
      return vals.length ? +(vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : 0
    }
    const avgAntig = avgArr(activos, e => yrsDiff(e.fecha_ingreso))
    const avgEdad = avgArr(activos, e => yrsDiff(e.fecha_nac))
    const menos6m = activos.filter(e => e.fecha_ingreso && yrsDiff(e.fecha_ingreso) < 0.5).length
    const mas6m = activos.length - menos6m

    // Generaciones
    const genPct = [0,0,0,0]
    activos.forEach(e => {
      if (!e.fecha_nac) return
      const y = new Date(e.fecha_nac).getFullYear()
      if (y >= 1994) genPct[0]++
      else if (y >= 1981) genPct[1]++
      else if (y >= 1969) genPct[2]++
      else genPct[3]++
    })
    const genTotal = genPct.reduce((a,b) => a+b, 1)
    const genPctFinal = genPct.map(n => +(n / genTotal * 100).toFixed(1))

    // Género, UEN, Departamento
    const countBy = (arr, key) => {
      const m = {}
      arr.forEach(e => { if (e[key]) m[e[key]] = (m[e[key]] || 0) + 1 })
      return m
    }
    const generoMap = countBy(activos, 'genero')
    const uenMap = countBy(activos_ob, 'uen')
    const deptMap = countBy(activos, 'departamento')

    // Antigüedad buckets
    const antigMap = { '< 1 año': 0, '1-2 años': 0, '2-3 años': 0, '3-5 años': 0, '5+ años': 0 }
    activos.forEach(e => {
      const y = yrsDiff(e.fecha_ingreso)
      if (y < 1) antigMap['< 1 año']++
      else if (y < 2) antigMap['1-2 años']++
      else if (y < 3) antigMap['2-3 años']++
      else if (y < 5) antigMap['3-5 años']++
      else antigMap['5+ años']++
    })

    // Finanzas
    const costoTotal = activos_ob.reduce((s,e) => s+(e.costo_real_mens||0), 0)
    const costoAnual = activos_ob.reduce((s,e) => s+(e.costo_real_anual||0), 0)
    const promCosto = activos.length ? costoTotal / activos.length : 0
    const distPct = costoTotal ? [
      { l: 'Sueldo base', v: Math.round(activos_ob.reduce((s,e)=>s+(e.sueldo_bruto||0),0)/costoTotal*100) },
      { l: 'Despensa', v: Math.round(activos_ob.reduce((s,e)=>s+(e.despensa||0),0)/costoTotal*100) },
      { l: 'Fondo ahorro', v: Math.round(activos_ob.reduce((s,e)=>s+(e.fondo_ahorro||0),0)/costoTotal*100) },
      { l: 'Gasolina', v: Math.round(activos_ob.reduce((s,e)=>s+(e.gasolina||0),0)/costoTotal*100) },
      { l: 'Prima vac.', v: Math.round(activos_ob.reduce((s,e)=>s+(e.prima_vacacional||0),0)/costoTotal*100) },
      { l: 'Celular', v: Math.round(activos_ob.reduce((s,e)=>s+(e.monto_celular||0),0)/costoTotal*100) },
      { l: 'SGMM', v: Math.round(activos_ob.reduce((s,e)=>s+(e.sgmm||0),0)/costoTotal*100) },
      { l: 'Seg. vida', v: Math.round(activos_ob.reduce((s,e)=>s+(e.seguro_vida||0),0)/costoTotal*100) },
    ].filter(d => d.v > 0) : []

    // Attrition
    const bajasAnio = inactivos.filter(e => e.fecha_termino?.startsWith(String(currentYear))).length
    const tasaRot = activos.length ? +((bajasAnio / (activos.length + bajasAnio)) * 100).toFixed(1) : 0
    const antigSalidaVals = inactivos.filter(e => e.fecha_ingreso && e.fecha_termino)
      .map(e => (new Date(e.fecha_termino) - new Date(e.fecha_ingreso)) / (1000*60*60*24*365.25))
    const avgAntigSalida = antigSalidaVals.length
      ? +(antigSalidaVals.reduce((a,b)=>a+b,0)/antigSalidaVals.length).toFixed(1) : 0

    const motivoMap = countBy(inactivos, 'razon_termino')
    const bajasMes = Array(12).fill(0)
    inactivos.filter(e => e.fecha_termino?.startsWith(String(currentYear)))
      .forEach(e => bajasMes[new Date(e.fecha_termino).getMonth()]++)
    const bajasDeptMap = countBy(inactivos, 'departamento')

    return {
      headcount: activos.length, onboarding: onboarding.length, offboarding: offboarding.length, total,
      pctIngr2025, pctIngr2026, avgAntig, avgEdad, menos6m, mas6m,
      genPct: genPctFinal, generoMap, uenMap, deptMap, antigMap,
      costoTotal, costoAnual, promCosto, distPct,
      bajasAnio, tasaRot, avgAntigSalida, motivoMap, bajasMes, bajasDeptMap,
      activos_ob_list: activos_ob, inactivos_list: inactivos,
    }
  }, [empleados])

  // â”€â”€ LOGIN HANDLERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleEmailContinue = async () => {
    setLoginErr('')
    setLoginMsg('')
    const email = loginEmail.trim().toLowerCase()
    if (!email) { setLoginErr('Ingresa tu correo corporativo'); return }

    try {
      await adminAuth('lookup_email', { email })
      setLoginStep('password')
    } catch (e) {
      if (e.code !== 'invalid_email') {
        setLoginErr('No fue posible validar tu acceso')
        return
      }
      supabase.from('solicitudes_admin').insert({ email, status: 'pending' }).catch(console.error)
      setLoginStep('pending')
    }
  }

  const handlePasswordLogin = async () => {
    setLoginErr('')
    setLoginMsg('')
    try {
      const { user: authUser } = await adminAuth('login', { email: loginEmail, password: loginPass })
      const nextUser = {
        ...authUser,
        initials: (authUser.name || authUser.email).split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || 'RH',
      }
      setUser(nextUser)
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ user: nextUser, page: 'dashboard' }))
    } catch (e) {
      if (e.code === 'password_not_set') setLoginErr('Tu cuenta aún no tiene contraseña. Usa "Olvidé contraseña".')
      else if (e.code === 'invalid_password') setLoginErr('Contraseña incorrecta')
      else setLoginErr('No encontramos tu acceso')
    }
  }

  const handleForgotPassword = async () => {
    setLoginErr('')
    setLoginMsg('')
    if (!loginEmail.trim()) { setLoginErr('Ingresa tu correo corporativo'); return }
    try {
      await adminAuth('request_reset', { email: loginEmail })
      setLoginMsg('Te enviamos un enlace para restablecer tu contraseña.')
    } catch (e) {
      setLoginErr(e.code === 'invalid_email' ? 'No encontramos ese correo.' : 'No fue posible enviar el enlace.')
    }
  }

  const handleResetPassword = async () => {
    const resetToken = searchParams.get('reset')
    setLoginErr('')
    if (!loginPass || loginPass.length < 8) { setLoginErr('La contraseña debe tener al menos 8 caracteres'); return }
    if (loginPass !== loginPassConfirm) { setLoginErr('Las contraseñas no coinciden'); return }
    try {
      await adminAuth('reset_password', { token: resetToken, password: loginPass })
      setLoginStep('password')
      setLoginPass('')
      setLoginPassConfirm('')
      setLoginMsg('Tu contraseña se actualizó. Ya puedes iniciar sesión.')
      setSearchParams({})
    } catch (e) {
      setLoginErr(e.code === 'expired_token' ? 'El enlace de recuperación expiró.' : 'No fue posible actualizar la contraseña.')
    }
  }

  // â”€â”€ LOGIN SCREENS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (!user) {
    const brandBg = { background: BRAND }
    const inputCls = 'px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 w-full'
    const btnPrimary = 'w-full py-2.5 text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50'
    const emailReady = !!loginEmail.trim()

    if (loginStep === 'email') return (
      <div className="min-h-screen flex items-center justify-center p-6" style={brandBg}>
        <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="px-8 pt-10 pb-7 text-center" style={brandBg}>
            <div className="font-serif text-white text-4xl font-bold leading-none">Areya</div>
            <div className="text-white/60 text-sm mt-3">Panel de administración · RRHH</div>
          </div>
          <div className="px-8 py-8 flex flex-col gap-4 bg-[#FBFAF8]">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#7A8191] uppercase tracking-wide">Correo corporativo</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoFocus
                placeholder="tu.nombre@areya.com.mx"
                onKeyDown={e => e.key === 'Enter' && handleEmailContinue()}
                className={`${inputCls} ${emailReady ? 'border-accent ring-4 ring-[#A79AF722] shadow-[0_8px_24px_rgba(167,154,247,0.18)]' : ''}`} />
            </div>
            {loginErr && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{loginErr}</div>}
            {loginMsg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">{loginMsg}</div>}
            <button onClick={handleEmailContinue} disabled={!emailReady}
              className={btnPrimary}
              style={emailReady
                ? { background: 'linear-gradient(135deg, #b0a5fb 0%, #9384f3 100%)', boxShadow: '0 16px 36px rgba(147,132,243,.34)' }
                : { background: '#d7d1f7', boxShadow: 'none' }}>
              Continuar →
            </button>
          </div>
        </div>
      </div>
    )

    if (loginStep === 'password') return (
      <div className="min-h-screen flex items-center justify-center p-6" style={brandBg}>
        <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="px-8 pt-10 pb-7 text-center" style={brandBg}>
            <div className="font-serif text-white text-4xl font-bold leading-none">Areya</div>
            <div className="text-white/60 text-sm mt-3">Panel de administración · RRHH</div>
          </div>
          <div className="px-8 py-8 flex flex-col gap-4 bg-[#FBFAF8]">
            <div className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-gray-200">
              <div className="w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 text-white" style={{ background: ACCENT }}>
                {loginEmail[0]?.toUpperCase() || '?'}
              </div>
              <span className="text-sm text-gray-700 flex-1 truncate">{loginEmail}</span>
              <button onClick={() => { setLoginStep('email'); setLoginPass(''); setLoginErr('') }}
                className="text-xs font-medium hover:underline flex-shrink-0" style={{ color: ACCENT }}>
                Cambiar
              </button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#7A8191] uppercase tracking-wide">Contraseña</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} autoFocus
                onKeyDown={e => e.key === 'Enter' && handlePasswordLogin()}
                className={inputCls} />
            </div>
            {loginErr && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{loginErr}</div>}
            {loginMsg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">{loginMsg}</div>}
            <button onClick={handlePasswordLogin} disabled={!loginPass}
              className={btnPrimary} style={{ background: ACCENT }}>
              Entrar al panel
            </button>
            <button onClick={() => { setLoginStep('forgot'); setLoginErr(''); setLoginMsg('') }}
              className="text-xs font-medium hover:underline text-left" style={{ color: ACCENT }}>
              Olvidé contraseña
            </button>
          </div>
        </div>
      </div>
    )

    if (loginStep === 'forgot') return (
      <div className="min-h-screen flex items-center justify-center p-6" style={brandBg}>
        <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="px-8 pt-10 pb-7 text-center" style={brandBg}>
            <div className="font-serif text-white text-4xl font-bold leading-none">Areya</div>
            <div className="text-white/60 text-sm mt-3">Recuperar acceso al panel</div>
          </div>
          <div className="px-8 py-8 flex flex-col gap-4 bg-[#FBFAF8]">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#7A8191] uppercase tracking-wide">Correo corporativo</label>
              <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} autoFocus
                onKeyDown={e => e.key === 'Enter' && handleForgotPassword()}
                className={inputCls} />
            </div>
            {loginErr && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{loginErr}</div>}
            {loginMsg && <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">{loginMsg}</div>}
            <button onClick={handleForgotPassword} disabled={!loginEmail.trim()}
              className={btnPrimary} style={{ background: ACCENT }}>
              Enviar enlace
            </button>
            <button onClick={() => { setLoginStep('password'); setLoginErr(''); setLoginMsg('') }}
              className="text-xs font-medium hover:underline text-left" style={{ color: ACCENT }}>
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )

    if (loginStep === 'reset') return (
      <div className="min-h-screen flex items-center justify-center p-6" style={brandBg}>
        <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm overflow-hidden">
          <div className="px-8 pt-10 pb-7 text-center" style={brandBg}>
            <div className="font-serif text-white text-4xl font-bold leading-none">Areya</div>
            <div className="text-white/60 text-sm mt-3">Restablecer contraseña</div>
          </div>
          <div className="px-8 py-8 flex flex-col gap-4 bg-[#FBFAF8]">
            <div className="bg-white rounded-lg px-3 py-2.5 text-sm text-gray-700 font-mono border border-gray-200">{loginEmail}</div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#7A8191] uppercase tracking-wide">Nueva contraseña</label>
              <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} autoFocus className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#7A8191] uppercase tracking-wide">Confirmar contraseña</label>
              <input type="password" value={loginPassConfirm} onChange={e => setLoginPassConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
                className={inputCls} />
            </div>
            {loginErr && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{loginErr}</div>}
            <button onClick={handleResetPassword} disabled={!loginPass || !loginPassConfirm}
              className={btnPrimary} style={{ background: ACCENT }}>
              Guardar nueva contraseña
            </button>
          </div>
        </div>
      </div>
    )

    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={brandBg}>
        <div className="bg-white rounded-[28px] shadow-2xl p-10 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="font-serif text-xl font-bold mb-2" style={{ color: BRAND }}>Acceso pendiente</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-5">
            Tu solicitud fue enviada al equipo de RRHH. Cuando sea aprobada, recibirás un correo en{' '}
            <strong className="text-gray-700">{loginEmail}</strong> para crear tu contraseña.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 mb-5">
            Tiempo de respuesta habitual: menos de 24 horas.
          </div>
          <button onClick={() => { setLoginStep('email'); setLoginEmail(''); setLoginErr('') }}
            className="text-sm font-medium hover:underline" style={{ color: ACCENT }}>
            ← Usar otro correo
          </button>
        </div>
      </div>
    )
  }

  // â”€â”€ IMPORT LOGIC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const processFile = (file, type) => {
    if (!file) return
    setImportData(null)
    setImportLog(null)
    const reader = new FileReader()
    reader.onerror = () => {
      showToast('No fue posible leer el archivo.')
    }
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true })
        if (!wb.SheetNames?.length) {
          showToast('El archivo no contiene hojas válidas.')
          return
        }
        // For master type: read ALL sheets and merge rows (employee data + tabulador on separate sheets)
        // For tareas type: first sheet only
        const sheetNames = type === 'master' ? wb.SheetNames : [wb.SheetNames[0]]
        const allRows = []
        for (const sheetName of sheetNames) {
          const ws = wb.Sheets[sheetName]
          if (!ws) continue
          const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
          const headerRowIndex = findHeaderRowIndex(matrix, type)
          const rows = buildRowsFromMatrix(matrix, headerRowIndex)
          allRows.push(...rows)
        }
        if (!allRows.length) {
          showToast('⚠ El archivo está vacío')
          return
        }
        setImportData({ rows: allRows, fileName: file.name, type })
        setImportLog(null)
      } catch (err) {
        console.error('processFile error:', err)
        showToast('Ese archivo no se pudo abrir. Revisa el formato e inténtalo de nuevo.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const runImport = async () => {
    if (!importData) return
    setImporting(true)
    const { rows, type } = importData
    const colMap = type === 'master' ? MASTER_COL_MAP : TAREAS_COL_MAP
    let inserted = 0, updated = 0, skipped = 0, lines = []
    let tabInserted = 0, tabUpdated = 0
    for (let i = 0; i < rows.length; i++) {
      try {
        if (type === 'master') {
          const mappedMaster = mapRow(rows[i], MASTER_COL_MAP)
          const mappedTabulador = mapRow(rows[i], TABULADOR_COL_MAP)
          const hasMasterData = Object.keys(mappedMaster).some(key => MASTER_FIELDS.has(key) && key !== 'nivel_tab' && key !== 'familia_puesto')
          const TABULADOR_SPECIFIC = new Set([REF_COL, 'brinco', LIM_INF_COL, LIM_SUP_COL, 'rango'])
          const hasTabData = Object.keys(mappedTabulador).some(key => TABULADOR_SPECIFIC.has(key))

          if (!hasMasterData && !hasTabData) {
            skipped++
            lines.push(`⚠ Fila ${i+2}: sin columnas reconocidas para master o tabulador`)
            continue
          }

          const MONEY_FIELDS = new Set(['sueldo_bruto','sueldo_neto','gasolina','despensa','fondo_ahorro','prima_vacacional','mant_auto','monto_celular','sgmm','seguro_vida','costo_real_mens','costo_real_anual','punto_medio','dif_pesos'])
          const PCT_FIELDS = new Set(['pct_prima','dif_pct'])
          const NUM_FIELDS = new Set(['gente_a_cargo','meses_bono','nivel_tab'])

          if (hasMasterData && mappedMaster['ID Colaborador']) {
            const masterPayload = Object.fromEntries(
              Object.entries(mappedMaster)
                .filter(([, value]) => value !== '' && value != null)
                .map(([key, value]) => {
                  if (MONEY_FIELDS.has(key)) return [key, parseMoneyLike(value)]
                  if (PCT_FIELDS.has(key)) return [key, parsePercentLike(value)]
                  if (NUM_FIELDS.has(key)) { const n = Number(String(value).replace(/[^\d.-]/g, '')); return [key, Number.isFinite(n) ? n : null] }
                  return [key, value]
                })
                .filter(([, v]) => v !== null && v !== '')
            )
            // nombre_completo is a generated column — remove it so DB computes it automatically
            delete masterPayload.nombre_completo
            const { data: ex, error: lookupError } = await supabase
              .from('empleados')
              .select('id')
              .eq('ID Colaborador', String(mappedMaster['ID Colaborador']).trim())
              .maybeSingle()

            if (lookupError) throw lookupError

            if (ex) {
              await updateEmpleado(ex.id, masterPayload)
              updated++
              lines.push(`✓ Master actualizado: ${mappedMaster['ID Colaborador']}`)
            } else {
              const { error: insertError } = await supabase.from('empleados').insert(masterPayload)
              if (insertError) throw insertError
              inserted++
              lines.push(`+ Master insertado: ${mappedMaster['ID Colaborador']}`)
            }
          } else if (hasMasterData) {
            lines.push(`⚠ Fila ${i+2}: columnas de master detectadas pero falta ID Colaborador`)
          }

          if (hasTabData && mappedTabulador.nivel !== '' && mappedTabulador.nivel != null) {
            const tabPayload = Object.fromEntries(
              Object.entries(mappedTabulador)
                .filter(([, value]) => value !== '' && value != null)
                .map(([key, value]) => {
                  if (key === 'nivel') { const n = Number(String(value).replace(/[^\d.-]/g, '')); return [key, Number.isFinite(n) ? n : null] }
                  if (key === 'brinco') return [key, parsePercentLike(value)]
                  if ([REF_COL, LIM_INF_COL, LIM_SUP_COL].includes(key)) return [key, parseMoneyLike(value)]
                  return [key, value]
                })
                .filter(([, v]) => v !== null && v !== '')
            )

            const { data: existingTab, error: tabLookupError } = await supabase
              .from('tabulador')
              .select('id, nivel')
              .eq('nivel', tabPayload.nivel)
              .maybeSingle()
            if (tabLookupError) throw tabLookupError

            await upsertTabuladorRow(tabPayload)
            if (existingTab) {
              tabUpdated++
              lines.push(`✓ Tabulador actualizado: nivel ${tabPayload.nivel}`)
            } else {
              tabInserted++
              lines.push(`+ Tabulador insertado: nivel ${tabPayload.nivel}`)
            }
          } else if (hasTabData) {
            lines.push(`⚠ Fila ${i+2}: columnas de tabulador detectadas pero falta nivel`)
          }
        } else {
          const mapped = mapRow(rows[i], colMap)
          const keyCol = 'titulo'
          if (!mapped[keyCol]) { skipped++; lines.push(`⚠ Fila ${i+2}: sin ${keyCol}`); continue }
          await upsertTemplate(mapped); inserted++; lines.push(`✓ Tarea: ${mapped.titulo} (${mapped.nivel})`)
        }
      } catch (err) { skipped++; lines.push(`✕ Fila ${i+2}: ${err.message?.slice(0,60)}`) }
    }
    setImportLog({ inserted, updated, skipped, lines, tabInserted, tabUpdated })
    setImporting(false)
    showToast(`✓ Importación completa - master: ${inserted} nuevos · ${updated} actualizados · tabulador: ${tabInserted} nuevos · ${tabUpdated} actualizados`)
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

  // â”€â”€ MAIN RENDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'master', label: 'Master empleados' },
    { id: 'tabulador', label: 'Tabulador' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'offboarding', label: 'Offboarding' },
    { id: 'importar', label: 'Importar datos' },
  ]

  const pageTitle = {
    dashboard: 'Dashboard',
    master: 'Master de empleados',
    tabulador: 'Tabulador de puestos',
    onboarding: 'Onboarding',
    offboarding: 'Offboarding',
    importar: 'Importar datos',
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-52 flex flex-col flex-shrink-0" style={{ background: BRAND }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <div className="font-serif text-white text-lg font-bold">Areya</div>
          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,.35)' }}>Sistema de RRHH</div>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)}
              className="w-full text-left px-5 py-2.5 text-sm font-medium transition-all border-l-2 flex items-center gap-2"
              style={{
                color: page === item.id ? '#fff' : 'rgba(255,255,255,.55)',
                background: page === item.id ? 'rgba(79,70,229,.25)' : 'transparent',
                borderLeftColor: page === item.id ? ACCENT : 'transparent',
              }}>
              {item.label}
              {item.id === 'onboarding' && empleados.filter(e => e.status === 'Onboarding').length > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
                  {empleados.filter(e => e.status === 'Onboarding').length}
                </span>
              )}
              {item.id === 'offboarding' && offboardingPendientes.length > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
                  {offboardingPendientes.length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: ACCENT }}>
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-semibold">{user.name}</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,.35)' }}>{user.rol}</div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem(ADMIN_SESSION_KEY)
              setUser(null)
              setPage('dashboard')
              setLoginStep('email')
              setLoginPass('')
              setLoginErr('')
              setLoginMsg('')
            }}
            className="text-[11px] font-semibold text-white/60 hover:text-white"
          >
            Salir
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 h-13 flex items-center justify-between flex-shrink-0" style={{ minHeight: 52 }}>
          <div className="font-serif text-base font-bold">{pageTitle[page] || page}</div>
          {loading && <div className="text-xs text-gray-400">Cargando...</div>}
        </div>

        <div className="p-6 flex-1">
          {page === 'dashboard' && (
            <DashboardPage
              stats={stats}
              empleados={empleados}
              pendingAdmins={pendingAdmins}
              onApproveAdmin={approveAdminRequest}
              dashTab={dashTab}
              setDashTab={setDashTab}
            />
          )}
          {page === 'master' && (
            <MasterTable
              empleados={empleados}
              search={search} setSearch={setSearch}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              loading={loading}
              onLoad={loadEmpleados}
              showToast={showToast}
            />
          )}
          {page === 'tabulador' && <TabuladorPage />}
          {page === 'onboarding' && <OnboardingPageAdmin empleados={empleados} onLoad={loadEmpleados} />}
          {page === 'offboarding' && <OffboardingPageAdmin entrevistas={offboardingPendientes} onComplete={() => { loadEmpleados(); loadOffboardingPendientes() }} />}
          {page === 'importar' && (
            <ImportPage
              importTab={importTab} setImportTab={setImportTab}
              importData={importData} setImportData={setImportData}
              importLog={importLog} setImportLog={setImportLog}
              importing={importing}
              onProcess={processFile}
              onRun={runImport}
              onDownloadTemplate={downloadTemplate}
            />
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}



export const TABULADOR = [
  { n: 0,  f: 'Practicante',      ref: 8400,   inf: 6300,   sup: 12600  },
  { n: 1,  f: 'Auxiliar',         ref: 10501,  inf: 10080,  sup: 15750  },
  { n: 2,  f: 'Analista Jr',      ref: 12601,  inf: 12600,  sup: 18900  },
  { n: 3,  f: 'Analista',         ref: 16801,  inf: 16800,  sup: 25200  },
  { n: 4,  f: 'Analista Sr',      ref: 21001,  inf: 21000,  sup: 31500  },
  { n: 5,  f: 'Especialista Jr',  ref: 25201,  inf: 25200,  sup: 37800  },
  { n: 6,  f: 'Especialista',     ref: 33602,  inf: 33600,  sup: 50400  },
  { n: 7,  f: 'Especialista Sr',  ref: 40002,  inf: 39900,  sup: 60000  },
  { n: 8,  f: 'Coordinador',      ref: 46002,  inf: 46000,  sup: 69000  },
  { n: 9,  f: 'Jefe de área',     ref: 58670,  inf: 59000,  sup: 88000  },
  { n: 10, f: 'Gerente',          ref: 71337,  inf: 71000,  sup: 107000 },
  { n: 11, f: 'Gerente Sr',       ref: 84004,  inf: 84000,  sup: 126000 },
  { n: 12, f: 'Subdirector',      ref: 110006, inf: 106000, sup: 165000 },
  { n: 13, f: 'Dirección',        ref: 146674, inf: 138000, sup: 220000 },
  { n: 14, f: 'Dir. estratégica', ref: 200010, inf: 189000, sup: 300000 },
  { n: 15, f: 'CEO / Dirección',  ref: 300015, inf: 250000, sup: 450000 },
]

/**
 * Dado un nivel de tabulador, calcula todos los campos de compensación
 * que se auto-llenan en el master de empleados.
 */
export function calcCompensacion(nivelNum) {
  const t = TABULADOR.find(x => x.n === Number(nivelNum))
  if (!t) return {}

  const sb = t.ref
  const n  = t.n

  const despensa          = Math.round(sb * 0.12)
  const fondo_ahorro      = Math.round(sb * 0.13)
  const prima_vacacional  = Math.round(sb * 0.25 / 12)
  const gasolina          = n >= 9 ? 4500 : n >= 6 ? 2500 : n >= 3 ? 1500 : 0
  const meses_bono        = n >= 13 ? 3 : n >= 10 ? 2 : n >= 7 ? 1.5 : n >= 4 ? 1 : 0
  const monto_celular     = n >= 8 ? 800 : n >= 5 ? 500 : 0
  const celular           = monto_celular > 0 ? 'Sí' : 'No'
  const sgmm              = n >= 6 ? 1800 : 0
  const seguro_vida       = n >= 4 ? Math.round(sb * 0.015) : 0
  const mant_auto         = n >= 10 ? 3000 : n >= 8 ? 1500 : 0
  const sueldo_neto       = Math.round(sb * 0.72)
  const rango_sueldo      = `$${t.inf.toLocaleString('es-MX')} – $${t.sup.toLocaleString('es-MX')}`
  const punto_medio       = t.ref
  const costo_real_mens   = Math.round(
    sb + gasolina + despensa + fondo_ahorro +
    (sb * meses_bono / 12) + prima_vacacional +
    monto_celular + sgmm + seguro_vida + mant_auto
  )

  return {
    familia_puesto: t.f,
    nivel_tab:      t.n,
    sueldo_bruto:   sb,
    sueldo_neto,
    gasolina:       gasolina || null,
    despensa,
    fondo_ahorro,
    meses_bono:     meses_bono || null,
    pct_prima:      25,
    prima_vacacional,
    mant_auto:      mant_auto || null,
    monto_celular:  monto_celular || null,
    celular,
    sgmm:           sgmm || null,
    seguro_vida:    seguro_vida || null,
    rango_sueldo,
    punto_medio,
    dif_pct:        0,
    dif_pesos:      0,
    costo_real_mens,
    costo_real_anual: costo_real_mens * 12,
  }
}

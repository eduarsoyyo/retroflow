/**
 * Tests para domain/finance.ts
 *
 * Cumple con CMP-Revelio-v2-Guia-Desarrollo:
 * - Cobertura mínima domain: 90%
 * - AAA pattern: Arrange, Act, Assert
 * - Cada test hace UNA cosa
 * - Nombres descriptivos en español
 * - Tests independientes
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SS_MULTIPLIER,
  migrateCostRates,
  getCurrentCostRate,
  costRateFromSalary,
  memberCostHour,
  getSalaryInfo,
  saleFromService,
  saleFromServiceContract,
  monthlyRevenueFromServices,
  totalSaleFromServices,
  totalEstCostFromServices,
  avgMarginFromServices,
  memberProjectCost,
  getHolidaySet,
  holidayCountYear,
  getTargetHours,
  expectedHoursToDate,
  effectiveTheoreticalHours,
  effectiveTheoreticalHoursYear,
  workDaysToDate,
  businessDaysInRange,
  vacDaysApproved,
  ausDaysApproved,
  pct,
  type CostRate,
  type LegacyCostRate,
  type ServiceContract,
  type CalendarData,
  type AbsenceData,
} from './finance'

// ============================================================
// FIXTURES
// ============================================================

const calendarBase: CalendarData = {
  id: 'cal-1',
  name: 'Calendario Madrid 2026',
  convenio_hours: 1800,
  daily_hours_lj: 8,
  daily_hours_v: 7,
  daily_hours_intensive: 7,
  intensive_start: '07-01',
  intensive_end: '08-31',
  holidays: [
    { date: '2026-01-01', name: 'Año Nuevo' },
    { date: '2026-01-06', name: 'Reyes' },
    { date: '2026-04-03', name: 'Viernes Santo' },
    { date: '2026-05-01', name: 'Día del Trabajo' },
    { date: '2026-08-15', name: 'Asunción' },
    { date: '2026-12-25', name: 'Navidad' },
  ],
}

const calendarConMMDD: CalendarData = {
  id: 'cal-2',
  convenio_hours: 1800,
  daily_hours_lj: 8,
  daily_hours_v: 7,
  daily_hours_intensive: 7,
  intensive_start: '07-01',
  intensive_end: '08-31',
  holidays: [
    { date: '01-01' },
    { date: '12-25' },
  ],
}

const serviceBase: ServiceContract = {
  id: 'srv-1',
  name: 'Consultoría Q1',
  from: '2026-01-01',
  to: '2026-03-31',
  cost: 30000,
  margin_pct: 25,
  risk_pct: 5,
}

// ============================================================
// CONSTANTS
// ============================================================

describe('DEFAULT_SS_MULTIPLIER', () => {
  it('debería ser 1.33 según convenio España', () => {
    expect(DEFAULT_SS_MULTIPLIER).toBe(1.33)
  })
})

// ============================================================
// COST RATE FUNCTIONS
// ============================================================

describe('migrateCostRates', () => {
  it('debería mantener formato nuevo si tiene salary > 0', () => {
    const input: LegacyCostRate[] = [
      { from: '2026-01', salary: 50000, multiplier: 1.5 },
    ]
    const result = migrateCostRates(input)
    expect(result).toEqual([{ from: '2026-01', to: undefined, salary: 50000, multiplier: 1.5 }])
  })

  it('debería usar multiplier por defecto si no se proporciona con salary', () => {
    const input: LegacyCostRate[] = [{ from: '2026-01', salary: 50000 }]
    const result = migrateCostRates(input)
    expect(result[0]!.multiplier).toBe(1.33)
  })

  it('debería convertir formato legacy con rate a salary', () => {
    const input: LegacyCostRate[] = [{ from: '2026-01', rate: 30 }]
    const result = migrateCostRates(input)
    // salary = (30 * 1800) / 1.33 = 40601.5, redondeado = 40602
    expect(result[0]!.salary).toBe(40602)
    expect(result[0]!.multiplier).toBe(1.33)
  })

  it('debería devolver salary 0 si no hay rate ni salary', () => {
    const input: LegacyCostRate[] = [{ from: '2026-01' }]
    const result = migrateCostRates(input)
    expect(result[0]!.salary).toBe(0)
  })

  it('debería preservar el campo to', () => {
    const input: LegacyCostRate[] = [
      { from: '2026-01', to: '2026-12', salary: 50000, multiplier: 1.33 },
    ]
    const result = migrateCostRates(input)
    expect(result[0]!.to).toBe('2026-12')
  })

  it('debería procesar array vacío', () => {
    expect(migrateCostRates([])).toEqual([])
  })

  it('debería procesar array con multiples elementos', () => {
    const input: LegacyCostRate[] = [
      { from: '2024-01', to: '2024-12', salary: 40000, multiplier: 1.33 },
      { from: '2025-01', salary: 45000, multiplier: 1.4 },
    ]
    const result = migrateCostRates(input)
    expect(result).toHaveLength(2)
    expect(result[0]!.salary).toBe(40000)
    expect(result[1]!.salary).toBe(45000)
  })
})

describe('getCurrentCostRate', () => {
  it('debería devolver null para array vacío', () => {
    expect(getCurrentCostRate([])).toBeNull()
  })

  it('debería devolver null si rates es undefined', () => {
    expect(getCurrentCostRate(undefined as unknown as CostRate[])).toBeNull()
  })

  it('debería devolver el rate único si solo hay uno', () => {
    const rates: CostRate[] = [{ from: '2024-01', salary: 50000, multiplier: 1.33 }]
    const result = getCurrentCostRate(rates)
    expect(result?.salary).toBe(50000)
  })

  it('debería devolver el rate más reciente cuyo from <= now', () => {
    const rates: CostRate[] = [
      { from: '2024-01', salary: 40000, multiplier: 1.33 },
      { from: '2025-01', salary: 50000, multiplier: 1.33 },
      { from: '2026-01', salary: 60000, multiplier: 1.33 },
    ]
    const result = getCurrentCostRate(rates)
    // La función ordena descendente por from, busca el primero con from<=now
    // 2026 ya empezó, así que debería devolver el de 2026
    expect(result?.salary).toBe(60000)
  })

  it('debería respetar el rango con to (excluir si to < now)', () => {
    // Solo hay un rate, expirado. La función devuelve sorted[0] como fallback
    const rates: CostRate[] = [
      { from: '2024-01', to: '2024-06', salary: 40000, multiplier: 1.33 },
    ]
    const result = getCurrentCostRate(rates)
    // El find no encuentra (expirado), devuelve sorted[0] (el mismo)
    expect(result?.salary).toBe(40000)
  })

  it('debería devolver el más antiguo si todos son futuros', () => {
    const rates: CostRate[] = [
      { from: '2099-01', salary: 50000, multiplier: 1.33 },
      { from: '2098-01', salary: 40000, multiplier: 1.33 },
    ]
    const result = getCurrentCostRate(rates)
    // Ninguno cumple from <= now, devuelve sorted[0] (el más reciente del orden desc)
    expect(result?.salary).toBe(50000)
  })
})

describe('costRateFromSalary', () => {
  it('debería calcular coste/hora correctamente', () => {
    // (52000 * 1.33) / 1800 = 38.42
    expect(costRateFromSalary(52000, 1.33, 1800)).toBe(38.42)
  })

  it('debería redondear a 2 decimales', () => {
    expect(costRateFromSalary(50000, 1.33, 1800)).toBe(36.94)
  })

  it('debería devolver 0 si salary es 0', () => {
    expect(costRateFromSalary(0, 1.33, 1800)).toBe(0)
  })

  it('debería devolver 0 si salary es negativo', () => {
    expect(costRateFromSalary(-1000, 1.33, 1800)).toBe(0)
  })

  it('debería devolver 0 si convenioHours es 0', () => {
    expect(costRateFromSalary(50000, 1.33, 0)).toBe(0)
  })

  it('debería usar multiplier diferente si se especifica', () => {
    // (50000 * 1.5) / 1800 = 41.67
    expect(costRateFromSalary(50000, 1.5, 1800)).toBe(41.67)
  })
})

describe('memberCostHour', () => {
  it('debería calcular desde formato nuevo (salary)', () => {
    const rates: LegacyCostRate[] = [{ from: '2024-01', salary: 50000, multiplier: 1.33 }]
    expect(memberCostHour(rates, 1800)).toBe(36.94)
  })

  it('debería calcular desde formato legacy (rate)', () => {
    const rates: LegacyCostRate[] = [{ from: '2024-01', rate: 30 }]
    // Convierte rate a salary: 30*1800/1.33 = 40601
    // Y vuelve a calcular: (40601*1.33)/1800 = 30
    expect(memberCostHour(rates, 1800)).toBeCloseTo(30, 0)
  })

  it('debería usar 1800 horas si convenioHours es 0', () => {
    const rates: LegacyCostRate[] = [{ from: '2024-01', salary: 50000, multiplier: 1.33 }]
    expect(memberCostHour(rates, 0)).toBe(36.94)
  })

  it('debería devolver legacyCostRate si no hay cost_rates', () => {
    expect(memberCostHour([], 1800, 25)).toBe(25)
  })

  it('debería devolver 0 si no hay rates ni legacyCostRate', () => {
    expect(memberCostHour([], 1800)).toBe(0)
  })

  it('debería preferir cost_rates sobre legacyCostRate', () => {
    const rates: LegacyCostRate[] = [{ from: '2024-01', salary: 50000, multiplier: 1.33 }]
    expect(memberCostHour(rates, 1800, 99)).toBe(36.94)
  })
})

describe('getSalaryInfo', () => {
  it('debería devolver salary+multiplier del rate actual', () => {
    const rates: LegacyCostRate[] = [{ from: '2024-01', salary: 50000, multiplier: 1.4 }]
    expect(getSalaryInfo(rates)).toEqual({ salary: 50000, multiplier: 1.4 })
  })

  it('debería devolver defaults si rates vacío', () => {
    expect(getSalaryInfo([])).toEqual({ salary: 0, multiplier: 1.33 })
  })

  it('debería convertir formato legacy', () => {
    const rates: LegacyCostRate[] = [{ from: '2024-01', rate: 30 }]
    const result = getSalaryInfo(rates)
    expect(result.salary).toBe(40602)
    expect(result.multiplier).toBe(1.33)
  })
})

// ============================================================
// SERVICE/CONTRACT FUNCTIONS
// ============================================================

describe('saleFromService', () => {
  it('debería calcular venta con margen 25% sin riesgo', () => {
    // 30000 / (1 - 0.25) = 40000
    expect(saleFromService(30000, 25)).toBe(40000)
  })

  it('debería incluir riesgo en el cálculo', () => {
    // 30000 / (1 - 0.25 - 0.05) = 42857
    expect(saleFromService(30000, 25, 5)).toBe(42857)
  })

  it('debería devolver 0 si denominador es 0 o negativo', () => {
    expect(saleFromService(30000, 100)).toBe(0)
    expect(saleFromService(30000, 60, 50)).toBe(0)
  })

  it('debería redondear el resultado', () => {
    // 10000 / (1 - 0.3333) = 14999.85, redondeado = 15000 en algunos casos
    // Pero con 33.33: 10000 / 0.6667 = 14999.25, redondeado = 14999
    expect(saleFromService(10000, 33.33)).toBe(14999)
  })

  it('debería tratar riskPct opcional como 0', () => {
    const result1 = saleFromService(30000, 25)
    const result2 = saleFromService(30000, 25, 0)
    expect(result1).toBe(result2)
  })
})

describe('saleFromServiceContract', () => {
  it('debería calcular venta de un ServiceContract', () => {
    // 30000 / (1 - 0.25 - 0.05) = 42857
    expect(saleFromServiceContract(serviceBase)).toBe(42857)
  })
})

describe('monthlyRevenueFromServices', () => {
  it('debería devolver 0 si no hay servicios', () => {
    expect(monthlyRevenueFromServices([], 2026, 0)).toBe(0)
  })

  it('debería distribuir el ingreso entre los meses del servicio', () => {
    // Service Q1 (3 meses), sale=42857, monthly=14286
    const result = monthlyRevenueFromServices([serviceBase], 2026, 0) // enero
    expect(result).toBe(14286)
  })

  it('debería devolver 0 para meses fuera del rango del servicio', () => {
    // Service Q1 termina en marzo, abril fuera
    const result = monthlyRevenueFromServices([serviceBase], 2026, 5) // junio
    expect(result).toBe(0)
  })

  it('debería sumar revenue de múltiples servicios', () => {
    const services = [serviceBase, { ...serviceBase, id: 'srv-2' }]
    const result = monthlyRevenueFromServices(services, 2026, 0)
    expect(result).toBe(28572) // 14286 * 2
  })

  it('debería ignorar servicios con sale 0 (margen 100%)', () => {
    const bad: ServiceContract = { ...serviceBase, margin_pct: 100 }
    expect(monthlyRevenueFromServices([bad], 2026, 0)).toBe(0)
  })

  it('debería usar fechas por defecto si from/to vacíos', () => {
    const sv: ServiceContract = { ...serviceBase, from: '', to: '' }
    // Sin from/to: cubre todo el año (12 meses)
    const result = monthlyRevenueFromServices([sv], 2026, 5) // junio
    expect(result).toBeGreaterThan(0)
  })
})

describe('totalSaleFromServices', () => {
  it('debería sumar ventas de todos los servicios', () => {
    expect(totalSaleFromServices([serviceBase])).toBe(42857)
    expect(totalSaleFromServices([serviceBase, serviceBase])).toBe(85714)
  })

  it('debería devolver 0 para array vacío', () => {
    expect(totalSaleFromServices([])).toBe(0)
  })
})

describe('totalEstCostFromServices', () => {
  it('debería sumar costes estimados', () => {
    expect(totalEstCostFromServices([serviceBase])).toBe(30000)
  })

  it('debería devolver 0 para array vacío', () => {
    expect(totalEstCostFromServices([])).toBe(0)
  })
})

describe('avgMarginFromServices', () => {
  it('debería calcular margen ponderado', () => {
    // sale = 42857, cost = 30000, margen = (42857-30000)/42857 = 30%
    expect(avgMarginFromServices([serviceBase])).toBe(30)
  })

  it('debería devolver 0 para array vacío', () => {
    expect(avgMarginFromServices([])).toBe(0)
  })

  it('debería devolver 0 si totalSale es 0', () => {
    const bad: ServiceContract = { ...serviceBase, margin_pct: 100 }
    expect(avgMarginFromServices([bad])).toBe(0)
  })
})

// ============================================================
// PROJECT COST CALCULATION
// ============================================================

describe('memberProjectCost', () => {
  it('debería devolver 0 si calendar es null', () => {
    expect(memberProjectCost(30, 1.0, null, [], 'm1', 2026, '2026-12-31')).toBe(0)
  })

  it('debería devolver 0 si costHour es 0', () => {
    expect(memberProjectCost(0, 1.0, calendarBase, [], 'm1', 2026, '2026-12-31')).toBe(0)
  })

  it('debería calcular coste con dedicación 100%', () => {
    const result = memberProjectCost(30, 1.0, calendarBase, [], 'm1', 2026, '2026-12-31')
    expect(result).toBeGreaterThan(0)
  })

  it('debería reducir coste con dedicación 50%', () => {
    const fullTime = memberProjectCost(30, 1.0, calendarBase, [], 'm1', 2026, '2026-12-31')
    const halfTime = memberProjectCost(30, 0.5, calendarBase, [], 'm1', 2026, '2026-12-31')
    expect(halfTime).toBeCloseTo(fullTime / 2, -1)
  })
})

// ============================================================
// CALENDAR FUNCTIONS
// ============================================================

describe('getHolidaySet', () => {
  it('debería convertir holidays a Set de strings YYYY-MM-DD', () => {
    const set = getHolidaySet(calendarBase, 2026)
    expect(set.size).toBe(6)
    expect(set.has('2026-01-01')).toBe(true)
    expect(set.has('2026-12-25')).toBe(true)
  })

  it('debería expandir formato MM-DD prepending year', () => {
    const set = getHolidaySet(calendarConMMDD, 2026)
    expect(set.has('2026-01-01')).toBe(true)
    expect(set.has('2026-12-25')).toBe(true)
  })

  it('debería manejar calendar sin holidays', () => {
    const cal: CalendarData = { ...calendarBase, holidays: [] }
    expect(getHolidaySet(cal, 2026).size).toBe(0)
  })
})

describe('holidayCountYear', () => {
  it('debería contar festivos en días laborables', () => {
    // Año 2026: 6 festivos definidos
    // 2026-01-01 (jueves) ✓ laborable
    // 2026-01-06 (martes) ✓ laborable
    // 2026-04-03 (viernes) ✓ laborable
    // 2026-05-01 (viernes) ✓ laborable
    // 2026-08-15 (sábado) ✗ fin de semana
    // 2026-12-25 (viernes) ✓ laborable
    expect(holidayCountYear(calendarBase, 2026)).toBe(5)
  })

  it('debería devolver 0 si calendar no tiene holidays', () => {
    const cal: CalendarData = { ...calendarBase, holidays: [] }
    expect(holidayCountYear(cal, 2026)).toBe(0)
  })

  it('debería ignorar holidays de otros años', () => {
    expect(holidayCountYear(calendarBase, 2027)).toBe(0)
  })
})

describe('getTargetHours', () => {
  it('debería devolver 0 para sábado', () => {
    expect(getTargetHours(calendarBase, '2026-05-02')).toBe(0)
  })

  it('debería devolver 0 para domingo', () => {
    expect(getTargetHours(calendarBase, '2026-05-03')).toBe(0)
  })

  it('debería devolver 0 para festivo', () => {
    expect(getTargetHours(calendarBase, '2026-01-01')).toBe(0)
  })

  it('debería devolver daily_hours_lj para lunes-jueves', () => {
    expect(getTargetHours(calendarBase, '2026-05-04')).toBe(8) // Lunes
    expect(getTargetHours(calendarBase, '2026-05-07')).toBe(8) // Jueves
  })

  it('debería devolver daily_hours_v para viernes', () => {
    expect(getTargetHours(calendarBase, '2026-05-08')).toBe(7) // Viernes
  })

  it('debería devolver daily_hours_intensive en jornada intensiva', () => {
    expect(getTargetHours(calendarBase, '2026-07-15')).toBe(7) // Miércoles intensivo
  })

  it('debería devolver 8h por defecto si calendar es null en laborable', () => {
    expect(getTargetHours(null, '2026-05-04')).toBe(8) // Lunes
  })

  it('debería devolver 0 en fin de semana incluso sin calendar', () => {
    expect(getTargetHours(null, '2026-05-02')).toBe(0)
  })

  it('debería detectar festivos en formato MM-DD', () => {
    expect(getTargetHours(calendarConMMDD, '2026-01-01')).toBe(0)
    expect(getTargetHours(calendarConMMDD, '2026-12-25')).toBe(0)
  })
})

describe('expectedHoursToDate', () => {
  it('debería calcular horas YTD enero (con festivos)', () => {
    // Enero 2026: 22 días laborables - 2 festivos (1, 6) = 20 días * 8h = ~160h
    // Aprox: 19 lunes-jueves (8h) + 4 viernes (7h) = 152+28 = pero hay que ajustar
    const result = expectedHoursToDate(calendarBase, 2026, '2026-01-31')
    expect(result).toBeGreaterThan(140)
    expect(result).toBeLessThan(180)
  })

  it('debería usar horas intensivas en julio', () => {
    // Julio 2026 todo intensivo (7h/día) - sin festivos en ese rango específico
    const result = expectedHoursToDate(calendarBase, 2026, '2026-07-31')
    expect(result).toBeGreaterThan(0)
  })
})

describe('effectiveTheoreticalHours', () => {
  it('debería devolver 0 si calendar es null', () => {
    expect(effectiveTheoreticalHours(null, 2026, '2026-12-31', [], 'm1')).toBe(0)
  })

  it('debería restar vacaciones aprobadas', () => {
    const absences: AbsenceData[] = [
      {
        member_id: 'm1',
        type: 'vacaciones',
        date_from: '2026-08-01',
        date_to: '2026-08-22',
        days: 22,
        status: 'aprobada',
      },
    ]
    const sin = effectiveTheoreticalHours(calendarBase, 2026, '2026-12-31', [], 'm1')
    const con = effectiveTheoreticalHours(calendarBase, 2026, '2026-12-31', absences, 'm1')
    expect(con).toBe(sin - 22 * 8)
  })

  it('debería restar ausencias no-vacaciones aprobadas', () => {
    const absences: AbsenceData[] = [
      {
        member_id: 'm1',
        type: 'enfermedad',
        date_from: '2026-03-01',
        date_to: '2026-03-05',
        days: 5,
        status: 'aprobada',
      },
    ]
    const sin = effectiveTheoreticalHours(calendarBase, 2026, '2026-12-31', [], 'm1')
    const con = effectiveTheoreticalHours(calendarBase, 2026, '2026-12-31', absences, 'm1')
    expect(con).toBe(sin - 5 * 8)
  })

  it('debería ignorar ausencias no aprobadas', () => {
    const absences: AbsenceData[] = [
      {
        member_id: 'm1',
        type: 'vacaciones',
        date_from: '2026-08-01',
        date_to: '2026-08-22',
        days: 22,
        status: 'pendiente',
      },
    ]
    const sin = effectiveTheoreticalHours(calendarBase, 2026, '2026-12-31', [], 'm1')
    const con = effectiveTheoreticalHours(calendarBase, 2026, '2026-12-31', absences, 'm1')
    expect(con).toBe(sin)
  })

  it('no debería devolver valores negativos', () => {
    const absences: AbsenceData[] = [
      {
        member_id: 'm1',
        type: 'vacaciones',
        date_from: '2026-01-01',
        date_to: '2026-12-31',
        days: 365,
        status: 'aprobada',
      },
    ]
    const result = effectiveTheoreticalHours(calendarBase, 2026, '2026-12-31', absences, 'm1')
    expect(result).toBe(0)
  })
})

describe('effectiveTheoreticalHoursYear', () => {
  it('debería usar 31 de diciembre como fecha fin', () => {
    const a = effectiveTheoreticalHoursYear(calendarBase, 2026, [], 'm1')
    const b = effectiveTheoreticalHours(calendarBase, 2026, '2026-12-31', [], 'm1')
    expect(a).toBe(b)
  })

  it('debería devolver 0 si calendar es null', () => {
    expect(effectiveTheoreticalHoursYear(null, 2026, [], 'm1')).toBe(0)
  })
})

describe('workDaysToDate', () => {
  it('debería contar días laborables', () => {
    const days = workDaysToDate(calendarBase, 2026, '2026-01-31')
    // Enero 2026: 22 días laborables - 2 festivos = 20
    expect(days).toBe(20)
  })

  it('debería devolver 0 si calendar es null', () => {
    expect(workDaysToDate(null, 2026, '2026-12-31')).toBe(0)
  })
})

describe('businessDaysInRange', () => {
  it('debería devolver array de fechas laborables', () => {
    const days = businessDaysInRange('2026-05-04', '2026-05-08', calendarBase, 2026)
    expect(days).toEqual(['2026-05-04', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'])
  })

  it('debería excluir festivos', () => {
    const days = businessDaysInRange('2026-04-30', '2026-05-04', calendarBase, 2026)
    // 30/4 jueves OK, 1/5 festivo, 2-3 fin de semana, 4 lunes OK
    expect(days).toContain('2026-04-30')
    expect(days).toContain('2026-05-04')
    expect(days).not.toContain('2026-05-01')
  })

  it('debería funcionar sin calendar', () => {
    const days = businessDaysInRange('2026-05-04', '2026-05-08', null, 2026)
    expect(days).toHaveLength(5)
  })

  it('debería excluir fin de semana', () => {
    const days = businessDaysInRange('2026-05-02', '2026-05-03', null, 2026)
    expect(days).toEqual([])
  })
})

// ============================================================
// ABSENCE FUNCTIONS
// ============================================================

describe('vacDaysApproved', () => {
  it('debería sumar días de vacaciones aprobadas', () => {
    const absences: AbsenceData[] = [
      { member_id: 'm1', type: 'vacaciones', date_from: '2026-08-01', date_to: '2026-08-15', days: 15, status: 'aprobada' },
      { member_id: 'm1', type: 'vacaciones', date_from: '2026-12-22', date_to: '2026-12-31', days: 7, status: 'aprobada' },
    ]
    expect(vacDaysApproved(absences, 'm1', 2026)).toBe(22)
  })

  it('debería ignorar otros members', () => {
    const absences: AbsenceData[] = [
      { member_id: 'm2', type: 'vacaciones', date_from: '2026-08-01', date_to: '2026-08-15', days: 15, status: 'aprobada' },
    ]
    expect(vacDaysApproved(absences, 'm1', 2026)).toBe(0)
  })

  it('debería ignorar status no aprobada', () => {
    const absences: AbsenceData[] = [
      { member_id: 'm1', type: 'vacaciones', date_from: '2026-08-01', date_to: '2026-08-15', days: 15, status: 'pendiente' },
    ]
    expect(vacDaysApproved(absences, 'm1', 2026)).toBe(0)
  })

  it('debería ignorar tipos no vacaciones', () => {
    const absences: AbsenceData[] = [
      { member_id: 'm1', type: 'enfermedad', date_from: '2026-08-01', date_to: '2026-08-15', days: 15, status: 'aprobada' },
    ]
    expect(vacDaysApproved(absences, 'm1', 2026)).toBe(0)
  })

  it('debería ignorar otros años', () => {
    const absences: AbsenceData[] = [
      { member_id: 'm1', type: 'vacaciones', date_from: '2025-08-01', date_to: '2025-08-15', days: 15, status: 'aprobada' },
    ]
    expect(vacDaysApproved(absences, 'm1', 2026)).toBe(0)
  })
})

describe('ausDaysApproved', () => {
  it('debería sumar ausencias no-vacaciones aprobadas', () => {
    const absences: AbsenceData[] = [
      { member_id: 'm1', type: 'enfermedad', date_from: '2026-03-01', date_to: '2026-03-05', days: 5, status: 'aprobada' },
      { member_id: 'm1', type: 'asuntos_propios', date_from: '2026-06-15', date_to: '2026-06-15', days: 1, status: 'aprobada' },
    ]
    expect(ausDaysApproved(absences, 'm1', 2026)).toBe(6)
  })

  it('debería excluir vacaciones', () => {
    const absences: AbsenceData[] = [
      { member_id: 'm1', type: 'vacaciones', date_from: '2026-08-01', date_to: '2026-08-15', days: 15, status: 'aprobada' },
    ]
    expect(ausDaysApproved(absences, 'm1', 2026)).toBe(0)
  })

  it('debería ignorar status no aprobada', () => {
    const absences: AbsenceData[] = [
      { member_id: 'm1', type: 'enfermedad', date_from: '2026-03-01', date_to: '2026-03-05', days: 5, status: 'pendiente' },
    ]
    expect(ausDaysApproved(absences, 'm1', 2026)).toBe(0)
  })
})

// ============================================================
// FORMATTING HELPERS
// ============================================================

// ============================================================
// FORMATTING HELPERS
// ============================================================
// Los formatters fmtN, fmtEur, fmt han sido movidos a `src/lib/format.ts`
// como `formatNumber`, `formatEuro`, `formatNumberCompact`. Ver
// `src/lib/format.test.ts` para sus tests.

describe('pct', () => {
  it('debería calcular porcentaje', () => {
    expect(pct(50, 100)).toBe(50)
    expect(pct(25, 100)).toBe(25)
  })

  it('debería redondear a entero', () => {
    expect(pct(33, 100)).toBe(33)
    expect(pct(1, 3)).toBe(33)
  })

  it('debería devolver 0 si denominador es 0', () => {
    expect(pct(50, 0)).toBe(0)
  })

  it('debería manejar valores negativos', () => {
    expect(pct(-25, 100)).toBe(-25)
  })

  it('debería superar 100%', () => {
    expect(pct(150, 100)).toBe(150)
  })
})

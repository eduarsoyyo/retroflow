import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ── PDF Export ──
interface PdfOptions {
  title: string
  subtitle?: string
  date?: string
  orientation?: 'portrait' | 'landscape'
}

interface TableData {
  title?: string
  headers: string[]
  rows: (string | number)[][]
}

export function exportPDF(tables: TableData[], opts: PdfOptions) {
  const doc = new jsPDF({ orientation: opts.orientation || 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Header
  doc.setFontSize(16)
  doc.setTextColor(0, 122, 255)
  doc.text('revelio', 14, 15)
  doc.setFontSize(12)
  doc.setTextColor(30, 30, 30)
  doc.text(opts.title, 14, 24)
  if (opts.subtitle) { doc.setFontSize(9); doc.setTextColor(140, 140, 140); doc.text(opts.subtitle, 14, 30) }
  doc.setFontSize(8); doc.setTextColor(140, 140, 140)
  doc.text(opts.date || new Date().toLocaleDateString('es-ES'), pageW - 14, 15, { align: 'right' })

  let startY = opts.subtitle ? 36 : 32

  tables.forEach((t, ti) => {
    if (ti > 0 && startY > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); startY = 20 }
    if (t.title) { doc.setFontSize(10); doc.setTextColor(30, 30, 30); doc.text(t.title, 14, startY); startY += 5 }

    autoTable(doc, {
      head: [t.headers],
      body: t.rows.map(r => r.map(c => String(c))),
      startY,
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: [0, 122, 255], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 250] },
      didDrawPage: () => {
        // Footer
        doc.setFontSize(7); doc.setTextColor(180, 180, 180)
        doc.text(`revelio — ${opts.title}`, 14, doc.internal.pageSize.getHeight() - 8)
        doc.text(`Página ${(doc as unknown as { internal: { pages: unknown[] } }).internal.pages.length - 1}`, pageW - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' })
      }
    })

    startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
  })

  doc.save(`${opts.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`)
}

// ── Excel Export ──
interface SheetData {
  name: string
  headers: string[]
  rows: (string | number)[][]
}

export function exportExcel(sheets: SheetData[], filename: string) {
  const wb = XLSX.utils.book_new()

  sheets.forEach(s => {
    const wsData = [s.headers, ...s.rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Column widths
    ws['!cols'] = s.headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...s.rows.map(r => String(r[i] || '').length))
      return { wch: Math.min(Math.max(maxLen + 2, 8), 30) }
    })

    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  })

  XLSX.writeFile(wb, `${filename.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`)
}

// ── Pre-built exports ──

export function exportPnLPDF(projectName: string, year: number, months: Array<{ revenue: number; cost: number; margin: number; hours: number }>, people: Array<{ name: string; months: Array<{ cost: number; hours: number }> }>) {
  const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })

  const tables: TableData[] = [
    {
      title: 'P&L Mensual',
      headers: ['Concepto', ...MO, 'Total'],
      rows: [
        ['Ingresos', ...months.map(m => fmt(m.revenue)), fmt(months.reduce((s, m) => s + m.revenue, 0))],
        ['Costes', ...months.map(m => fmt(m.cost)), fmt(months.reduce((s, m) => s + m.cost, 0))],
        ['Margen', ...months.map(m => fmt(m.margin)), fmt(months.reduce((s, m) => s + m.margin, 0))],
        ['Horas', ...months.map(m => fmt(m.hours)), fmt(months.reduce((s, m) => s + m.hours, 0))],
      ]
    },
    {
      title: 'Coste por persona',
      headers: ['Persona', ...MO, 'Total'],
      rows: people.map(p => [p.name, ...p.months.map(m => fmt(m.cost)), fmt(p.months.reduce((s, m) => s + m.cost, 0))])
    }
  ]

  exportPDF(tables, { title: `P&L ${projectName} ${year}`, subtitle: `Generado desde Revelio` })
}

export function exportPnLExcel(projectName: string, year: number, months: Array<{ revenue: number; cost: number; margin: number; hours: number }>, people: Array<{ name: string; months: Array<{ cost: number; hours: number }> }>) {
  const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

  exportExcel([
    {
      name: 'P&L',
      headers: ['Concepto', ...MO, 'Total'],
      rows: [
        ['Ingresos', ...months.map(m => m.revenue), months.reduce((s, m) => s + m.revenue, 0)],
        ['Costes', ...months.map(m => m.cost), months.reduce((s, m) => s + m.cost, 0)],
        ['Margen', ...months.map(m => m.margin), months.reduce((s, m) => s + m.margin, 0)],
        ['Horas', ...months.map(m => m.hours), months.reduce((s, m) => s + m.hours, 0)],
      ]
    },
    {
      name: 'Desglose',
      headers: ['Persona', ...MO, 'Total'],
      rows: people.map(p => [p.name, ...p.months.map(m => m.cost), p.months.reduce((s, m) => s + m.cost, 0)])
    }
  ], `PnL-${projectName}-${year}`)
}

export function exportRisksPDF(projectName: string, risks: Array<{ title: string; type: string; status: string; prob?: string; impact?: string; owner?: string }>) {
  exportPDF([{
    title: 'Registro de riesgos',
    headers: ['Título', 'Tipo', 'Estado', 'Probabilidad', 'Impacto', 'Responsable'],
    rows: risks.map(r => [r.title, r.type, r.status, r.prob || '—', r.impact || '—', r.owner || '—'])
  }], { title: `Riesgos — ${projectName}`, orientation: 'landscape' })
}

export function exportTeamExcel(projectName: string, team: Array<{ name: string; role: string; dedication: number; costRate: number; projects: string }>) {
  exportExcel([{
    name: 'Equipo',
    headers: ['Nombre', 'Rol', 'Dedicación %', 'Coste €/h', 'Proyectos'],
    rows: team.map(t => [t.name, t.role, t.dedication, t.costRate, t.projects])
  }], `Equipo-${projectName}`)
}

// ── Executive PPTX Export ──
export async function exportExecutivePPTX(project: {
  name: string; health: number; pctDone: number; overdue: number; blocked: number
  risks: Array<{ title: string; prob: string; impact: string; status: string }>
  milestones: Array<{ text: string; date: string; status: string }>
  team: Array<{ name: string; role: string; dedication: number }>
}) {
  const pptxgen = (await import('pptxgenjs')).default
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Revelio'

  const BLUE = '007AFF'; const GREEN = '34C759'; const RED = 'FF3B30'; const ORANGE = 'FF9500'; const GRAY = '8E8E93'
  const healthColor = project.health >= 75 ? GREEN : project.health >= 50 ? ORANGE : RED

  // Slide 1: Title
  const s1 = pptx.addSlide()
  s1.addText('INFORME DE ESTADO', { x: 0.5, y: 0.5, fontSize: 12, color: GRAY, fontFace: 'Arial' })
  s1.addText(project.name, { x: 0.5, y: 1.0, fontSize: 28, bold: true, color: '1D1D1F', fontFace: 'Arial' })
  s1.addText(new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }), { x: 0.5, y: 1.8, fontSize: 14, color: GRAY })
  s1.addText('revelio', { x: 0.5, y: 4.5, fontSize: 16, color: BLUE, bold: true })

  // Slide 2: KPIs
  const s2 = pptx.addSlide()
  s2.addText('ESTADO GENERAL', { x: 0.5, y: 0.3, fontSize: 18, bold: true, color: '1D1D1F' })
  const kpis = [
    { label: 'Salud', value: `${project.health}%`, color: healthColor },
    { label: 'Progreso', value: `${project.pctDone}%`, color: project.pctDone >= 70 ? GREEN : ORANGE },
    { label: 'Vencidos', value: String(project.overdue), color: project.overdue > 0 ? RED : GREEN },
    { label: 'Bloqueados', value: String(project.blocked), color: project.blocked > 0 ? RED : GREEN },
  ]
  kpis.forEach((k, i) => {
    const x = 0.5 + i * 2.3
    s2.addShape(pptx.ShapeType.roundRect, { x, y: 1.2, w: 2, h: 1.5, fill: { color: 'F5F5F7' }, rectRadius: 0.1 })
    s2.addText(k.value, { x, y: 1.4, w: 2, fontSize: 36, bold: true, color: k.color, align: 'center' })
    s2.addText(k.label, { x, y: 2.2, w: 2, fontSize: 11, color: GRAY, align: 'center' })
  })

  // Slide 3: Risks
  if (project.risks.length > 0) {
    const s3 = pptx.addSlide()
    s3.addText('RIESGOS TOP', { x: 0.5, y: 0.3, fontSize: 18, bold: true, color: '1D1D1F' })
    const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
      [{ text: 'Riesgo', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }, { text: 'Prob.', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }, { text: 'Impacto', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }, { text: 'Estado', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }]
    ]
    project.risks.slice(0, 5).forEach(r => {
      rows.push([{ text: r.title }, { text: r.prob || '—' }, { text: r.impact || '—' }, { text: r.status }])
    })
    s3.addTable(rows, { x: 0.5, y: 1.0, w: 9, fontSize: 10, border: { pt: 0.5, color: 'E5E5EA' }, colW: [4, 1.5, 1.5, 2] })
  }

  // Slide 4: Milestones
  if (project.milestones.length > 0) {
    const s4 = pptx.addSlide()
    s4.addText('HITOS', { x: 0.5, y: 0.3, fontSize: 18, bold: true, color: '1D1D1F' })
    const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
      [{ text: 'Hito', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }, { text: 'Fecha', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }, { text: 'Estado', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }]
    ]
    project.milestones.forEach(m => {
      const isDone = m.status === 'done'
      rows.push([{ text: m.text }, { text: m.date || '—' }, { text: isDone ? 'Completado' : m.status, options: { color: isDone ? GREEN : ORANGE } }])
    })
    s4.addTable(rows, { x: 0.5, y: 1.0, w: 9, fontSize: 10, border: { pt: 0.5, color: 'E5E5EA' }, colW: [5, 2, 2] })
  }

  // Slide 5: Team
  if (project.team.length > 0) {
    const s5 = pptx.addSlide()
    s5.addText('EQUIPO', { x: 0.5, y: 0.3, fontSize: 18, bold: true, color: '1D1D1F' })
    const rows: Array<Array<{ text: string; options?: Record<string, unknown> }>> = [
      [{ text: 'Persona', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }, { text: 'Rol', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }, { text: 'Dedicación', options: { bold: true, color: 'FFFFFF', fill: { color: BLUE } } }]
    ]
    project.team.forEach(t => {
      rows.push([{ text: t.name }, { text: t.role }, { text: `${Math.round(t.dedication * 100)}%` }])
    })
    s5.addTable(rows, { x: 0.5, y: 1.0, w: 9, fontSize: 10, border: { pt: 0.5, color: 'E5E5EA' }, colW: [4, 3, 2] })
  }

  pptx.writeFile({ fileName: `Informe-${project.name}-${new Date().toISOString().slice(0, 10)}.pptx` })
}

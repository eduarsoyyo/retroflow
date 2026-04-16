# Revelio — Guía de refactorización a 3 capas

## Diagnóstico del monolito actual

### Anatomía de `index.html` (10.327 líneas)

```
Líneas 1-83      Config, imports CDN, Supabase init
Líneas 84-400    Data access (sbLoad*, sbSave*, sbDelete*) → 55 funciones
Líneas 400-700   Constants, celebration, helpers mezclados
Líneas 700-1100  State management, realtime, login logic
Líneas 1100-2400 Home page + admin panels (UI + data + lógica mezclados)
Líneas 2400-4500 Centro de Control (RoomPicker, admin dashboard)
Líneas 4500-5300 PEquipo (Skill Matrix) — UI + CRUD + cálculos en un bloque
Líneas 5300-6800 Task management, editors, modals
Líneas 6800-7700 Risk management (RiskCard, PRiesgos, EscaladoPanel)
Líneas 7700-8300 Vacaciones, User Profile
Líneas 8300-10327 RetroBoard (fases, auto-save, PDF export, celebration)
```

### Problemas concretos

| Problema | Ejemplo real | Línea |
|----------|-------------|-------|
| Data en UI | `sbLoadTeamMembers().then(m => setTeam(m))` dentro de un componente | 4524 |
| Lógica en UI | `calculateCriticality()` definida como función global, usada inline | 6841 |
| Sin validación | `upsert(m, {onConflict:'id'})` sin validar campos | 89 |
| Errors silenciados | `catch { return []; }` — el usuario no sabe que falló | 86 |
| Estado global via window | `window.__allMembers`, `window.__currentRisks` | 1675, 6869 |
| Props drilling 8+ niveles | `RiskCard` recibe 16 props | 7065 |
| Sin tipado | Todo es `any` implícito | Todo |
| Key en cliente | Supabase anon key en HTML | 32 |

---

## Las 3 capas

```
╔═══════════════════════════════════════════════════════════╗
║  PRESENTACIÓN (src/components/)                          ║
║  • Preact JSX components                                 ║
║  • Solo renderiza y captura eventos                      ║
║  • Lee estado de stores (Signals)                        ║
║  • Llama a services para ejecutar acciones               ║
║  • NUNCA importa de data/                                ║
╠═══════════════════════════════════════════════════════════╣
║  NEGOCIO (src/domain/ + src/services/)                   ║
║  • domain/: funciones puras (0 deps, 100% testable)      ║
║  • services/: orquestación (llama data + aplica domain)  ║
║  • Schemas Zod para validación                           ║
║  • Tipos TypeScript como contratos                       ║
╠═══════════════════════════════════════════════════════════╣
║  INFRAESTRUCTURA (src/data/ + src/lib/)                  ║
║  • data/: acceso a Supabase (única dependencia externa)  ║
║  • lib/: errors, logger, env config                      ║
║  • Devuelve Result<T,E> — nunca lanza excepciones        ║
║  • Reemplazable sin tocar negocio ni presentación        ║
╚═══════════════════════════════════════════════════════════╝
```

### Regla de dependencias (inviolable)

```
components → services → domain
                ↓
              data → lib
```

- `domain/` SOLO importa de `types/`. Nada más. Nunca.
- `data/` SOLO importa de `lib/` y `types/`. Nunca de domain.
- `services/` importa de `domain/` y `data/`. Nunca de components.
- `components/` importa de `services/`, `stores/`, `hooks/`. Nunca de data.

Si necesitas saltarte esta regla, el diseño es incorrecto.

---

## Criterios para extraer lógica de negocio

### Test del "¿dónde va esto?"

Para cada función en el monolito, hazte estas preguntas:

```
¿Usa DOM, JSX, html``, eventos, estilos?
  → SÍ: components/
  → NO: sigue ↓

¿Necesita Supabase, localStorage, fetch, WebSocket?
  → SÍ: data/
  → NO: sigue ↓

¿Combina llamadas a data/ con cálculos de domain/?
  → SÍ: services/
  → NO: sigue ↓

¿Es un cálculo puro (entrada → salida, sin side effects)?
  → SÍ: domain/
```

### Mapa de extracción del monolito

| Función actual | Ubicación | Destino | Razón |
|---|---|---|---|
| `calculateCriticality(prob, impact)` | global (L6841) | `domain/criticality.ts` | Cálculo puro, 0 deps |
| `memberFit(mid)` | dentro PEquipo (L4550) | `domain/skills.ts` | Cálculo puro |
| `voteMajority(votes, def)` | global (L6853) | `domain/criticality.ts` | Cálculo puro |
| `fitColor(pct)` | dentro PEquipo (L4555) | `domain/skills.ts` | Mapeo simple |
| `heatColor(imp, prob)` | global (L6851) | `domain/criticality.ts` | Wrapper |
| Salud global | inline AdminDashboard | `domain/health.ts` | Fórmula compuesta |
| `riskNumber(risk, all)` | inline RiskCard | `domain/risks.ts` | Cálculo puro |
| `sbLoadTeamMembers()` | global (L84) | `data/team.ts` | Acceso a datos |
| `sbSaveSkillProfile(p)` | global (L305) | `data/skills.ts` | Acceso a datos |
| `sbLoadRetros()` | global (L215) | `data/retros.ts` | Acceso a datos |
| Carga dashboard completo | inline AdminDashboard | `services/dashboard.ts` | Orquestación |
| Evaluación + sugerencias | inline PEquipo | `services/skills.ts` | Orquestación |
| Auto-save retro | inline RetroBoard | `services/retro.ts` | Orquestación |
| `Icon()` | global (L1100) | `components/common/Icon.tsx` | UI puro |
| `RiskCard()` | global (L7065) | `components/risks/RiskCard.tsx` | UI |
| `PEquipo()` | global (L4486) | `components/project/SkillMatrix.tsx` | UI |

---

## Antes / Después — Ejemplos concretos

### Ejemplo 1: Cálculo de encaje (domain)

**ANTES** (monolito L4550-4558, dentro del componente):
```javascript
// Mezclado dentro de PEquipo — imposible de testear sin montar UI
function PEquipo() {
  // ...50 líneas de state...
  
  const memberFit = (mid) => {
    const prof = memberProfile(mid);  // otra closure del componente
    if(!prof) return null;
    const reqs = profileSkillsFor(prof.id);  // otra closure
    if(!reqs.length) return null;
    const totalReq = reqs.reduce((s,r)=>s+r.required_level,0);
    const totalAct = reqs.reduce((s,r)=>s+Math.min(
      memberSkillLevel(mid,r.skill_id),  // OTRA closure
      r.required_level
    ),0);
    return Math.round(totalAct/totalReq*100);
  };
  
  // ...400 líneas más de JSX que usan memberFit...
}
```

**DESPUÉS** (`src/domain/skills.ts`):
```typescript
// Función pura. Recibe datos, devuelve resultado. Testable en 1ms.
import type { ProfileSkill, MemberSkill } from '@types/index';

export function memberFit(
  memberId: string,
  profileSkills: ProfileSkill[],
  memberSkills: MemberSkill[],
): number | null {
  if (!profileSkills?.length) return null;
  const totalReq = profileSkills.reduce((s, ps) => s + ps.required_level, 0);
  if (totalReq === 0) return null;
  const totalAct = profileSkills.reduce((s, ps) => {
    const ms = memberSkills.find(x => x.member_id === memberId && x.skill_id === ps.skill_id);
    return s + Math.min(ms?.current_level ?? 0, ps.required_level);
  }, 0);
  return Math.round(totalAct / totalReq * 100);
}
```

**Test** (`src/domain/__tests__/skills.test.ts`):
```typescript
it('calculates 89% when one skill is below required', () => {
  const ps = [
    { id:'1', profile_id:'p1', skill_id:'s1', required_level: 4 },
    { id:'2', profile_id:'p1', skill_id:'s2', required_level: 3 },
    { id:'3', profile_id:'p1', skill_id:'s3', required_level: 2 },
  ];
  const ms = [
    { id:'a', member_id:'m1', skill_id:'s1', current_level: 4, notes:'' },
    { id:'b', member_id:'m1', skill_id:'s2', current_level: 2, notes:'' },  // gap!
    { id:'c', member_id:'m1', skill_id:'s3', current_level: 3, notes:'' },  // exceeds
  ];
  expect(memberFit('m1', ps, ms)).toBe(89);  // (4+2+2)/(4+3+2) = 89%
});
```

---

### Ejemplo 2: Acceso a datos (data)

**ANTES** (monolito L84-91):
```javascript
// Error silenciado. Sin tipos. Sin feedback al usuario.
async function sbLoadTeamMembers() {
  try { 
    const {data} = await supabase.from('team_members').select('*').order('name'); 
    return data || []; 
  } catch { return []; }  // ← ¿Qué falló? Nadie lo sabe.
}

async function sbSaveTeamMember(m) {
  try {
    const { error } = await supabase.from('team_members').upsert(m, { onConflict:'id' });
    if (error) console.error('sbSaveTeamMember error:', error);  // ← Solo en consola
  } catch(e) { console.error('sbSaveTeamMember', e); }
}
```

**DESPUÉS** (`src/data/team.ts`):
```typescript
import { supabase } from './supabase';
import { ok, err, type Result, DataError } from '@lib/errors';
import { createLogger } from '@lib/logger';
import type { Member } from '@types/index';

const log = createLogger('data:team');

// Result<T,E> obliga al llamador a manejar el error.
// No puede ignorarlo — TypeScript no compila si no haces el check.
export async function loadTeamMembers(): Promise<Result<Member[]>> {
  try {
    const { data, error } = await supabase.from('team_members').select('*').order('name');
    if (error) {
      log.error('loadTeamMembers failed', error, { code: error.code });
      return err(new DataError('Failed to load team', { code: error.code }));
    }
    return ok(data ?? []);
  } catch (e) {
    log.error('loadTeamMembers exception', e);
    return err(new DataError('Network error loading team'));
  }
}

// El componente DEBE manejar ambos casos:
// const result = await loadTeamMembers();
// if (!result.ok) { showToast(result.error.userMessage); return; }
// setTeam(result.data);  // ← TypeScript sabe que aquí data es Member[]
```

---

### Ejemplo 3: Orquestación (services)

**ANTES** (monolito, inline en AdminDashboard ~L1890-2060):
```javascript
// 170 líneas de cálculos DENTRO del JSX template literal
${(()=>{
  const members = window.__allMembers||[];
  const totalAct = Object.values(allData).flatMap(d=>d.actions||[]);
  const totalRisks = Object.values(allData).flatMap(d=>d.risks||[]);
  const actDone = totalAct.filter(a=>a.status==='done').length;
  // ...30 variables más...
  const tareasAlDia = actTotal>0 ? (actDone+actOnTrack)/actTotal : 1;
  const riesgosCtrl = (rMitigated+rOpen.length)>0 ? ...
  // ...TODO el cálculo de salud inline...
  const salud = Math.round(tareasAlDia*30 + riesgosCtrl*25 + ...);
  
  return html`<div>...KPIs con los 30 variables...</div>`;
})()}
```

**DESPUÉS** (`src/services/dashboard.ts`):
```typescript
// El service orquesta: carga datos → aplica lógica → devuelve resultado limpio
import { loadTeamMembers } from '@data/team';
import { loadRetros } from '@data/retros';
import { calculateHealth } from '@domain/health';
import { calculateCriticality } from '@domain/criticality';
import type { HealthScore, ProjectMetrics } from '@types/index';

export interface DashboardData {
  health: HealthScore;
  projectMetrics: ProjectMetrics[];
  // ...estructura clara de lo que el componente necesita
}

export async function loadDashboardData(filterSlugs?: string[]): Promise<DashboardData> {
  // 1. Cargar datos (data layer)
  const [membersResult, retrosResult] = await Promise.all([
    loadTeamMembers(),
    loadRetros(),
  ]);
  
  // 2. Manejar errores
  const members = membersResult.ok ? membersResult.data : [];
  const snaps = retrosResult.ok ? retrosResult.data : [];
  
  // 3. Aplicar lógica de negocio (domain layer)
  const health = calculateHealth({
    totalTasks: allTasks.length,
    tasksDone,
    // ...datos limpios que ya calculó
  });
  
  // 4. Devolver estructura tipada
  return { health, projectMetrics };
}
```

**Componente** (`src/components/admin/AdminDashboard.tsx`):
```typescript
// El componente SOLO renderiza. Cero lógica de negocio.
import { loadDashboardData, type DashboardData } from '@services/dashboard';
import { useAsync } from '@hooks';

export function AdminDashboard({ filterProject }: Props) {
  const { data, loading, error } = useAsync(
    () => loadDashboardData(filterProject),
    [filterProject]
  );

  if (loading) return <Loading />;
  if (error) return <ErrorCard message={error} />;
  if (!data) return null;

  return (
    <div>
      <HealthKPI score={data.health.score} color={data.health.color} />
      <ProjectTable metrics={data.projectMetrics} />
    </div>
  );
}
```

---

### Ejemplo 4: Componente (antes vs después)

**ANTES** (monolito L7065 — RiskCard con 16 props):
```javascript
function RiskCard({r, fromHist, upd, del, setEId, setEF, eId, eF, saveE, 
  teamMembers, getAlerts, tags, hasTag, entityTagList, quickToggleTag, 
  IMPACT_BTNS, allRisks, riskNum, onOpenDetail}) {
  // 80 líneas de lógica + JSX mezclados
  const hc = (r.type||'riesgo')==='problema'?'#FF3B30':heatColor(r.impact,r.prob);
  const allR = window.__currentRisks||[];
  const idx = allR.filter(x=>...).findIndex(x=>x.id===r.id)+1;
  // ...
}
```

**DESPUÉS** (`src/components/risks/RiskCard.tsx`):
```typescript
import type { Risk } from '@types/index';
import { riskTitle, riskNumber, RISK_TYPES } from '@domain/risks';
import { critColor } from '@domain/criticality';

// Props tipadas, mínimas, con responsabilidad clara
interface RiskCardProps {
  risk: Risk;
  allRisks: Risk[];
  onOpenDetail: (r: Risk) => void;
  onUpdate?: (id: string, patch: Partial<Risk>) => void;
  readOnly?: boolean;
}

export function RiskCard({ risk, allRisks, onOpenDetail, readOnly }: RiskCardProps) {
  // Lógica: delegada a domain
  const num = riskNumber(risk, allRisks);
  const color = critColor(risk.prob, risk.impact);
  const title = riskTitle(risk);

  // Solo JSX
  return (
    <div onClick={() => !readOnly && onOpenDetail(risk)}
      style={{ borderLeft: `4px solid ${color}`, /* ... */ }}>
      <span style={{ color, fontWeight: 800 }}>{num}</span>
      <span style={{ fontWeight: 600 }}>{title}</span>
      {risk.description && (
        <p style={{ fontSize: 11, color: '#6E6E73' }}>
          {risk.description.slice(0, 80)}
        </p>
      )}
    </div>
  );
}
```

---

## Buenas prácticas anti-regresión

### 1. Lint rule: imports entre capas

```json
// .eslintrc.json — regla custom
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        { "group": ["@data/*"], "importNames": ["*"],
          "message": "Components cannot import from data/. Use services/." },
        { "group": ["@components/*"],
          "message": "Domain cannot import from components/." }
      ]
    }]
  },
  "overrides": [
    { "files": ["src/domain/**"], "rules": {
      "no-restricted-imports": ["error", {
        "patterns": [
          { "group": ["@data/*", "@services/*", "@components/*", "@stores/*", "@hooks/*"],
            "message": "Domain must be pure — no external dependencies." }
        ]
      }]
    }},
    { "files": ["src/components/**"], "rules": {
      "no-restricted-imports": ["error", {
        "patterns": [
          { "group": ["@data/*"],
            "message": "Components call services, not data directly." }
        ]
      }]
    }}
  ]
}
```

### 2. Coverage mínima por capa

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    'src/domain/**': { statements: 90, branches: 85, functions: 90 },
    'src/services/**': { statements: 70, functions: 80 },
    // components: no threshold — visual testing preferred
  }
}
```

### 3. PR checklist

Todo PR debe responder:
- [ ] ¿La lógica nueva está en `domain/` o en un componente? Si está en el componente, ¿por qué?
- [ ] ¿Los datos se cargan desde `services/` o directamente desde `data/`?
- [ ] ¿Hay tests para la lógica nueva?
- [ ] ¿El componente tiene más de 200 líneas? → dividir
- [ ] ¿Alguna función tiene más de 5 parámetros? → crear interface

### 4. Señales de que estás volviendo al monolito

| Señal de alarma | Acción |
|---|---|
| Componente > 300 líneas | Extraer sub-componentes |
| `supabase.from(` en un componente | Mover a data/, llamar desde services/ |
| `Math.round(` o `filter(` en JSX | Extraer a domain/ |
| `window.__` para pasar datos | Usar stores (Signals) |
| Props > 6 | Crear interface o usar Context/Signal |
| `try { } catch { return [] }` | Usar Result<T,E> |
| `any` en TypeScript | Crear type/interface |
| Copy-paste de una función | Extraer a módulo compartido |

---

## Roadmap de refactorización

### Fase 1 — Cimientos (1 semana)
**Objetivo**: build funcional, domain testado, CI verde.

- [x] Scaffolding Vite + TypeScript
- [x] domain/ con tests (criticality, skills, health, risks)
- [x] data/ con Result<T,E>
- [x] lib/ (errors, logger, env)
- [x] types/ con Zod schemas
- [x] CI pipeline (typecheck + lint + test)
- [ ] Migrar `Icon.tsx` (primer componente)
- [ ] Migrar `ConfirmModal.tsx`

### Fase 2 — Componentes core (2 semanas)
**Objetivo**: risk management completo migrado.

- [ ] `RiskCard.tsx` + test
- [ ] `RiskDetailModal.tsx`
- [ ] `EscaladoPanel.tsx`
- [ ] `Heatmap.tsx`
- [ ] `services/risks.ts` (orquestación)
- [ ] stores: `riskStore.ts` (signals)

### Fase 3 — Skill Matrix (1 semana)
- [ ] `SkillMatrix.tsx` (PEquipo split en 5 sub-componentes)
- [ ] `services/skills.ts`
- [ ] stores: `skillStore.ts`

### Fase 4 — Retro + Dashboard (2 semanas)
- [ ] RetroBoard split en P1-P6 individuales
- [ ] `services/retro.ts` (auto-save, broadcast)
- [ ] `AdminDashboard.tsx`
- [ ] `services/dashboard.ts`

### Fase 5 — Auth + Security (1 semana)
- [ ] Supabase Auth real
- [ ] RLS policies por usuario
- [ ] Env vars en Netlify
- [ ] Eliminar anon key del cliente

### Fase 6 — Features nuevas
- [ ] Predicción de entrega (probabilidad basada en velocidad histórica)
- [ ] Impacto cross-proyecto (alertas cuando un recurso está sobrecargado)
- [ ] Métricas automáticas (inferir salud sin input manual)

---

## Estructura final

```
revelio/
├── .github/workflows/ci.yml     ← CI: typecheck + lint + test + build
├── .env.example                  ← Template de variables (sin secretos)
├── docs/adr/                     ← Decisiones de arquitectura
├── tests/
│   ├── setup.ts                  ← Mock de env, Supabase
│   ├── fixtures/                 ← Datos de prueba compartidos
│   └── e2e/                      ← Playwright (futuro)
├── src/
│   ├── types/index.ts            ← Contratos: Zod schemas + TS interfaces
│   ├── lib/
│   │   ├── errors.ts             ← Result<T,E>, AppError, DataError
│   │   ├── logger.ts             ← Logger estructurado
│   │   └── env.ts                ← Env vars validadas con Zod
│   ├── domain/                   ← LÓGICA PURA (0 dependencias externas)
│   │   ├── criticality.ts        ← Heatmap, votación
│   │   ├── skills.ts             ← Fit, gaps, niveles
│   │   ├── health.ts             ← Salud del servicio
│   │   ├── risks.ts              ← Escalado, numeración
│   │   └── __tests__/            ← 23+ tests unitarios
│   ├── data/                     ← INFRAESTRUCTURA (solo Supabase)
│   │   ├── supabase.ts           ← Client singleton
│   │   ├── team.ts               ← Result<Member[]>
│   │   ├── rooms.ts              ← Result<Room[]>
│   │   ├── retros.ts             ← Snapshots, métricas
│   │   └── skills.ts             ← 7 tablas skill matrix
│   ├── services/                 ← ORQUESTACIÓN (data + domain)
│   │   ├── dashboard.ts          ← Carga completa del dashboard
│   │   ├── skills.ts             ← Evaluación + formación
│   │   └── retro.ts              ← Auto-save, broadcast, lifecycle
│   ├── stores/                   ← ESTADO REACTIVO (Preact Signals)
│   │   └── app.ts                ← user, rooms, toasts, notifications
│   ├── hooks/                    ← HOOKS REUTILIZABLES
│   │   └── index.ts              ← useAsync, useDebounce
│   ├── styles/
│   │   └── tokens.ts             ← Design system
│   └── components/               ← PRESENTACIÓN (JSX tipado)
│       ├── common/               ← Icon, Modal, Tooltip, ErrorCard
│       ├── home/                 ← UserHomePage
│       ├── admin/                ← AdminDashboard, MaestrosPanel
│       ├── project/              ← RetroBoard, SkillMatrix
│       ├── retro/                ← P1Repaso...P6Dashboard, Celebration
│       └── risks/                ← RiskCard, RiskDetail, Heatmap
├── index.html                    ← Solo <div id="app">
├── package.json
├── tsconfig.json                 ← Strict mode, path aliases
├── vite.config.ts                ← Build, code splitting, aliases
└── vitest.config.ts              ← Coverage thresholds por capa
```

Cada fichero tiene UNA responsabilidad.
Cada capa tiene UNA dirección de dependencias.
Cada función es testable en aislamiento.

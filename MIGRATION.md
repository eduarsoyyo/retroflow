# Revelio — Guía de migración

## Quick start

```bash
cd revelio
npm install
npm run dev        # http://localhost:3000
npm run test       # unit tests
npm run validate   # typecheck + lint + tests
npm run build      # producción
```

## Qué hay migrado

| Capa | Ficheros | Tests | Estado |
|------|----------|-------|--------|
| `types/` | Schemas Zod + interfaces TS | — | ✅ Completo |
| `lib/errors` | Result<T,E>, AppError, DataError | — | ✅ |
| `lib/logger` | Logger estructurado por módulo | — | ✅ |
| `lib/env` | Validación de env vars con Zod | — | ✅ |
| `domain/criticality` | calculateCriticality, voteMajority | ✅ 10 tests | ✅ |
| `domain/skills` | memberFit, findAllGaps, fitColor | ✅ 8 tests | ✅ |
| `domain/health` | calculateHealth (salud global) | ✅ 5 tests | ✅ |
| `domain/risks` | riskTitle, riskNumber, escalation | — | ✅ |
| `data/supabase` | Client singleton | — | ✅ |
| `data/team` | CRUD team_members + org_chart | — | ✅ |
| `data/rooms` | CRUD rooms | — | ✅ |
| `data/retros` | Snapshots + métricas | — | ✅ |
| `data/skills` | CRUD 7 tablas skill matrix | — | ✅ |
| `services/dashboard` | Orquestación dashboard | — | ✅ |
| `stores/app` | Signals: user, rooms, toasts | — | ✅ |
| `hooks/` | useAsync, useDebounce | — | ✅ |
| `styles/tokens` | Design tokens, estilos base | — | ✅ |
| `.github/workflows` | CI: typecheck+lint+test+build | — | ✅ |
| `docs/adr/` | ADR-001 Architecture, ADR-002 Security | — | ✅ |

## Arquitectura

```
┌─────────────────────────────────────────────────┐
│  components/          UI (Preact JSX)           │
│  ├── common/          Icon, Modal, Tooltip      │
│  ├── home/            UserHomePage              │
│  ├── admin/           Dashboard, Maestros       │
│  ├── project/         RetroBoard, PRiesgos...   │
│  ├── retro/           P1-P6, Celebration        │
│  └── risks/           RiskCard, Heatmap...      │
├─────────────────────────────────────────────────┤
│  hooks/               useAsync, useDebounce     │
│  stores/              Preact Signals (estado)   │
├─────────────────────────────────────────────────┤
│  services/            Use cases (orquestación)  │
│  ├── dashboard.ts     Carga+calcula dashboard   │
│  ├── retro.ts         Gestión retro lifecycle   │
│  └── skills.ts        Evaluación+formación      │
├─────────────────────────────────────────────────┤
│  domain/              Lógica PURA (0 deps)      │
│  ├── criticality.ts   Heatmap, votación         │
│  ├── skills.ts        Fit, gaps, niveles        │
│  ├── health.ts        Salud del servicio        │
│  └── risks.ts         Escalado, numeración      │
├─────────────────────────────────────────────────┤
│  data/                Supabase CRUD             │
│  ├── supabase.ts      Client                    │
│  ├── team.ts          team_members, org_chart   │
│  ├── rooms.ts         rooms                     │
│  ├── retros.ts        retros, retro_metrics     │
│  └── skills.ts        7 tablas skill matrix     │
├─────────────────────────────────────────────────┤
│  lib/                 Utilidades transversales   │
│  ├── errors.ts        Result<T,E>, AppError     │
│  ├── logger.ts        Structured logging        │
│  └── env.ts           Env validation (Zod)      │
├─────────────────────────────────────────────────┤
│  types/index.ts       Zod schemas + TS types    │
│  styles/tokens.ts     Design system             │
└─────────────────────────────────────────────────┘
```

### Regla de dependencias (ESTRICTA)

```
types ← lib ← domain ← data ← services ← hooks/stores ← components
              ↑ NUNCA importa nada más allá de types
```

## Cómo migrar un componente

### 1. Identificar en el monolito
```bash
grep -n "function RiskCard" index.html
```

### 2. Crear fichero JSX
```tsx
// src/components/risks/RiskCard.tsx
import { type Risk } from '@types/index';
import { riskTitle, riskNumber, RISK_TYPES } from '@domain/risks';
import { critColor } from '@domain/criticality';

interface RiskCardProps {
  risk: Risk;
  allRisks: Risk[];
  onOpenDetail: (r: Risk) => void;
  readOnly?: boolean;
}

export function RiskCard({ risk, allRisks, onOpenDetail, readOnly }: RiskCardProps) {
  const num = riskNumber(risk, allRisks);
  const color = critColor(risk.prob, risk.impact);
  
  return (
    <div 
      onClick={() => !readOnly && onOpenDetail(risk)}
      style={{ /* ... */ }}
    >
      <span style={{ color, fontWeight: 800 }}>{num}</span>
      <span>{riskTitle(risk)}</span>
    </div>
  );
}
```

### 3. Conversión htm → JSX

| htm (monolito) | JSX (nuevo) |
|---|---|
| `` html`<div>...</div>` `` | `<div>...</div>` |
| `${{color:'red'}}` | `{{color:'red'}}` |
| `${expr}` | `{expr}` |
| `onClick=${fn}` | `onClick={fn}` |
| `` <${Component} /> `` | `<Component />` |
| `${cond && html`...`}` | `{cond && (<.../>)}` |
| `${arr.map(x=>html`...`)}` | `{arr.map(x=>(<.../>))}` |

### 4. Añadir props tipadas
```tsx
// ANTES: function RiskCard({r, fromHist, upd, del, ...})
// DESPUÉS:
interface RiskCardProps {
  risk: Risk;          // tipado
  readOnly?: boolean;  // opcional explícito
  onUpdate: (id: string, patch: Partial<Risk>) => void;
  onDelete: (id: string) => void;
}
```

### 5. Escribir test
```tsx
// src/components/risks/__tests__/RiskCard.test.tsx
import { render, screen } from '@testing-library/preact';
import { RiskCard } from '../RiskCard';

describe('RiskCard', () => {
  const mockRisk: Risk = {
    id: '1', title: 'Test risk', type: 'riesgo',
    impact: 'alto', prob: 'alta', status: 'open',
    // ...
  };

  it('renders risk number and title', () => {
    render(<RiskCard risk={mockRisk} allRisks={[mockRisk]} onOpenDetail={() => {}} />);
    expect(screen.getByText('R1')).toBeTruthy();
    expect(screen.getByText('Test risk')).toBeTruthy();
  });
});
```

## Orden de migración

| # | Componente | Deps | Dificultad | Impacto |
|---|-----------|------|-----------|---------|
| 1 | `Icon` | 0 | ⭐ | Alto (usado en todo) |
| 2 | `ConfirmModal` | Icon | ⭐ | Medio |
| 3 | `Tooltip` | 0 | ⭐ | Bajo |
| 4 | `RiskCard` | domain/risks, domain/criticality | ⭐⭐ | Alto |
| 5 | `RiskDetailModal` | RiskCard, data | ⭐⭐⭐ | Alto |
| 6 | `EscaladoPanel` | RiskCard | ⭐⭐ | Medio |
| 7 | `Heatmap` | domain/criticality | ⭐⭐ | Medio |
| 8 | `PEquipo` | data/skills, domain/skills | ⭐⭐⭐ | Alto |
| 9 | `PTrabajo` | stores, data | ⭐⭐⭐ | Alto |
| 10 | `PRiesgos` | RiskCard, Heatmap, EscaladoPanel | ⭐⭐⭐⭐ | Alto |
| 11 | `AdminDashboard` | services/dashboard | ⭐⭐⭐ | Alto |
| 12 | `UserHomePage` | stores, hooks | ⭐⭐⭐ | Alto |
| 13 | `RetroBoard` | todo | ⭐⭐⭐⭐⭐ | Crítico |
| 14 | `App` (router) | todo | ⭐⭐⭐⭐ | Crítico |

## Coexistencia

Durante la migración, el monolito sigue en `main` funcionando.
La nueva arquitectura vive en una rama `modular`.
Cuando todo esté migrado: merge `modular → main`.

## CI/CD

El pipeline de GitHub Actions ejecuta en cada PR:
1. `tsc --noEmit` — errores de tipo
2. `eslint` — estilo de código
3. `vitest --coverage` — tests con cobertura mínima (90% domain)
4. `vite build` — verificar que compila

Si cualquier paso falla, el PR no se puede mergear.

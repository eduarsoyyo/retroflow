# ADR-001: Arquitectura de 4 capas

**Estado**: Aprobado  
**Fecha**: 2026-04-14  
**Autor**: Claude + Jaime

## Contexto

Revelio es un monolito de ~10.300 líneas en un solo fichero HTML con Preact+htm+Supabase.
El crecimiento de funcionalidades (Skill Matrix, Escalado, Dashboard global) ha hecho el fichero inmantenible.

## Decisión

Adoptar arquitectura de 4 capas con dependencias unidireccionales:

```
Components → Services → Domain
                ↓
              Data
```

### Capas

| Capa | Responsabilidad | Puede importar de | Nunca importa de |
|------|----------------|-------------------|------------------|
| **types/** | Contratos (interfaces, schemas Zod) | Nada | — |
| **domain/** | Lógica de negocio pura | types | data, services, components |
| **data/** | Acceso a Supabase | types, lib | domain, services, components |
| **services/** | Orquestación (use cases) | domain, data, types, lib | components |
| **stores/** | Estado reactivo (signals) | types | domain, data, services |
| **hooks/** | Hooks reutilizables | stores, lib | domain, data |
| **components/** | UI (Preact JSX) | todo lo anterior | — |

### Regla de oro
**domain/ no importa nada excepto types.** Si necesitas datos, pásalos como parámetro.

## Tecnologías

| Decisión | Elección | Razón |
|----------|----------|-------|
| Framework | Preact | Ya en uso, ligero, compatible React |
| Build | Vite | Zero-config, HMR, tree-shaking |
| Tipos | TypeScript strict | Contratos entre capas, refactoring seguro |
| Validación | Zod | Runtime validation + types inferidos |
| State | Preact Signals | Reactivo sin boilerplate, mejor que Context |
| Tests | Vitest | Compatible Vite, rápido, coverage |
| E2E | Playwright | Cross-browser, CI-friendly |
| CI | GitHub Actions | Ya en GitHub |
| Lint | ESLint + TS plugin | Consistencia de código |
| Error handling | Result<T,E> | Force callers to handle errors |
| Logging | Structured logger | Niveles, módulos, extensible a Sentry |

## Consecuencias

**Positivas**:
- Domain testable sin mock de BBDD ni DOM
- Cambiar Supabase por otro backend solo toca data/
- Componentes más pequeños y enfocados
- CI bloquea PRs con errores de tipo o tests rotos

**Negativas**:
- Migración gradual (semanas)
- Curva de aprendizaje TypeScript
- Más ficheros que mantener

## Alternativas consideradas

- **Next.js**: Overkill para SPA sin SSR
- **Redux**: Demasiado boilerplate para este tamaño
- **Mantener monolito**: Insostenible a 10K+ líneas

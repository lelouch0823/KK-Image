# Type Safety

> Type safety patterns in this project.

---

## Overview

<!--
Document your project's type safety conventions here.

Questions to answer:
- What type system do you use?
- How are types organized?
- What validation library do you use?
- How do you handle type inference?
-->

(To be filled by the team)

---

## Type Organization

<!-- Where types are defined, shared types vs local types -->

(To be filled by the team)

---

## Validation

<!-- Runtime validation patterns (Zod, Yup, io-ts, etc.) -->

(To be filled by the team)

---

## Common Patterns

<!-- Type utilities, generics, type guards -->

(To be filled by the team)

---

## Forbidden Patterns

<!-- any, type assertions, etc. -->

(To be filled by the team)

---

## Convention: Root Frontend Typecheck Is A Quality Gate

**What**: The root Vue/Vite frontend must pass `pnpm typecheck:frontend` (`vue-tsc --noEmit -p tsconfig.json`) before frontend remediation work is considered complete.

**Why**: Vite can build Vue and TypeScript files while still allowing type-only imports used as runtime/local type names, invalid library config fields, or dynamic `{}` object inference to slip through. Root `vue-tsc` catches these failures.

**Required pattern**:

```bash
pnpm typecheck:frontend
```

**Checklist**:

- Import shared types both as local bindings and exported types when a file uses them internally:
  ```ts
  import type { ApiResponse } from '@/utils/api-types';
  export type { ApiResponse } from '@/utils/api-types';
  ```
- For dynamic import/mapping rows, define a narrow `Record<string, unknown>`-based interface instead of relying on `{}` inference.
- Validate third-party config objects against their current TypeScript types; remove unsupported fields instead of suppressing errors.
- Keep Vue SFC scripts aligned with the project ESLint parser constraints; put TypeScript-heavy helpers in `.ts` files.

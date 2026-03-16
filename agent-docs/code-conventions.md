# Code Conventions

## Functions

- Use arrow functions whenever possible — for components, hooks, callbacks, and utilities
- `export default` is not allowed; use named exports only

## File Naming

| Type | Convention | Examples |
|------|------------|---------|
| Components | PascalCase | `TransactionTable.tsx`, `ConnectButton.tsx` |
| Hooks | camelCase | `useGoogleSheets.ts` |
| Utilities / types | camelCase | `utils.ts`, `monzo.ts` |

## Exports

- Named exports only for components:
  ```ts
  export const Foo = () => {};
  ```
- No default exports in component files

## Props Types

- Use `type` alias (not `interface`) for component props
- Name pattern: `<ComponentName>Props`

  ```ts
  type TransactionTableProps = {
    transactions: MonzoTransaction[];
  };
  ```

## Imports

- Use `import type` for type-only imports:
  ```ts
  import type { MonzoTransaction } from '@/types/monzo';
  ```

## Styling

- Use Tailwind CSS classes for all styling — no separate CSS files
- Use `cn()` from `@/lib/utils` for conditional or merged class names:
  ```ts
  import { cn } from '@/lib/utils';
  className={cn('base-class', condition && 'conditional-class')}
  ```

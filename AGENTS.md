# Agent Guidelines

## Build, Lint & Test Commands

- **Install dependencies**: `pnpm install`
- **Dev server**: `pnpm dev`
- **Build**: `pnpm build`
- **Type check**: `pnpm check` (svelte-check)
- **Format**: `pnpm format` (prettier)
- **Run all tests**: `pnpm test`
- **Run single test file**: `pnpm test src/my-file.test.ts`
- **Run specific test**: `pnpm test -t "test name"` (via vitest)

## Code Style Guidelines

**Imports**: Group imports as follows: external dependencies, then relative imports. Sort alphabetically within each group.

**Formatting**: Use Prettier (configured with svelte plugin). Pre-commit hooks auto-format changes.

**Types**: Use TypeScript strict mode (target: es2023). Export types with `type` keyword. Use discriminated unions for complex meta types.

**Naming**: Use camelCase for variables/functions, PascalCase for classes/components. Prefix event handlers with on\* (onMount, onClick).

**Functions** use const and arrow function.

**Error Handling**: Use try-catch for async operations. Propagate errors with meaningful context.

**Testing**: Use Vitest with descriptive test names. Test structure: describe → it → expect. Keep tests focused and isolated.

**Svelte**: Use script lang="ts" for TypeScript. Reactive statements with `$:`. Component imports use PascalCase file references.

## Development Guidelines

- Never commit changes to git.
- Use type instead of interfaces in typescript

## Node Version

Requires Node 24 (configured in package.json engines).

---
name: shadcn-ui
description: Adds and composes UI using shadcn/ui and the project components.json. Use for new buttons, forms, dialogs, tables, navigation primitives, registries, or when the user mentions shadcn, Radix, base-ui, or npx shadcn.
---

# shadcn/ui (this project)

Official overview: [shadcn/ui Skills](https://ui.shadcn.com/docs/skills). Optional upstream skill bundle: `npx skills add shadcn/ui -y` (install scope is editor-specific; this repo already ships `.codex/skills/shadcn-ui`).

## Before writing custom markup

1. Run `npx shadcn@latest info --json` and honor `aliases`, `tailwindCssFile`, `iconLibrary`, `style`, and installed `components`.
2. Prefer registry components: `npx shadcn@latest search`, then `npx shadcn@latest add <name>`. For API details: `npx shadcn@latest docs <name>`.
3. Import from `@/components/ui/...` (see `components.json`). Use semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`) and `cn()` from `@/lib/utils`.
4. New files that use hooks or events in the App Router need `"use client"` when `components.json` has `rsc` / server boundaries require it.

## Trading desk compatibility

`Button` in `src/components/ui/button.tsx` includes legacy variants **`glass`**, **`pill`**, and **`primary`** for existing dashboard chrome. Prefer shadcn variants (`default`, `outline`, `ghost`, …) for new features unless matching the glass desk style.

## Do not

- Hand-copy large blocks from the registry; use the CLI so deps and paths stay correct.
- Put secrets in client-visible env vars.

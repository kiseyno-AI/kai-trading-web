# Visibility and Efficiency Refactor Plan

## Objective

Make the Web application faster to understand and safer to operate by reducing
navigation and dashboard noise, improving responsive hierarchy, and ensuring
that every displayed trading value is traceable to validated upstream data.

## Non-negotiable boundaries

- Change `kai-trading-web` only. Do not modify Core, Exec, broker state, orders,
  positions, or external services.
- Keep the browser on the read-only BFF boundary. The dashboard must not expose
  process-control actions.
- Never replace unavailable data with plausible prices, scores, dates, market
  sessions, or another symbol's row.
- Preserve existing URL continuity for calendar dates, feedback filters, and
  symbol return context while routes are simplified.
- Add no dependencies. Reuse the existing tokens, components, and test stack.

## Target product shape

Use one responsive application shell with four primary destinations in the
same order at every viewport:

1. Overview (`/dashboard`)
2. Explore (`/search`)
3. Review (`/calendar`)
4. Portfolio (`/portfolio`)

Specialized screens remain reachable through contextual links. Misleading or
duplicate top-level surfaces redirect to the closest canonical destination:

- `/real-dashboard`, `/kis-dashboard`, and `/bots` -> `/dashboard`
- `/scanner-tracker` -> `/my-symbols`
- `/markets` -> `/markets/factors`

`/dashboard/decider-feedback` remains the shared multi-agent decision-review
surface so `agent=short-term-decider` continues to load short-term rows.
`/dashboard/signal-decider-feedback` remains available as the signal-only
compatibility surface.

## Data-integrity contract

- Initial dashboard quotes are empty and unavailable until a validated response
  arrives; mock rows never enter the shared snapshot.
- Symbol detail and factor selectors accept exact normalized symbol matches only.
- A requested market date is current only when the resolved/actual data date
  agrees with it; an echoed request alone is not evidence.
- Unknown numeric values remain unavailable rather than becoming zero.
- Review totals include completed review states only.
- Period labels must match the underlying metric window.

## Ordered cleanup passes

1. Lock the contracts above with focused regression tests.
2. Fix unsafe selection and freshness logic, then redirect synthetic and
   duplicate routes.
3. Consolidate the route registry and remove unreachable legacy shell/demo code
   after checking every import.
4. Simplify the Overview hierarchy to decisions, risk, market context, and one
   expandable data-health surface. Remove duplicate inline process panels and
   process-control actions.
5. Refine the shared shell and dashboard styles for compact spacing, clear
   status semantics, four-item mobile navigation, and responsive two-column
   reading order.
6. Update README and architecture documentation to match the final behavior.

## Verification gates

- Focused regression tests before and after each behavior change.
- ESLint, unit tests, display-regression tests, production Webpack build, and
  the full Playwright suite.
- Browser review at desktop and mobile widths with console, overflow, keyboard,
  and screenshot evidence.
- Final diff review confirms that no Core or Exec repository changed and that
  synthetic trading values are no longer reachable from production routes.

## Deliberately deferred structural work

Moving every route to a new URL namespace and collapsing the six symbol-detail
modes into three would create a broad deep-link migration. This pass keeps those
working URLs stable and removes them from primary navigation instead. A later
change can migrate them with dedicated redirect and history-continuity tests.

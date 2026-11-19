# Frontend architecture

The frontend is organized around a shared application context and feature-owned
pages. Local section selection remains state-driven; the application does not
use a router.

## Structure

- `src/app/App.tsx` provides the application context and renders `AppLayout`.
- `src/app/AppLayout.tsx` owns the shared shell, navigation, appearance controls,
  and composition of feature pages.
- `src/context/AppContext.tsx` exposes shared state and actions from
  `src/hooks/useLabApp.ts` without passing them through page props. Focused
  hooks split state, preferences, attendance, orders, reports, and derived data.
- `src/features/<feature>/` contains focused page components. Each workflow
  dialog has its own component under `src/features/workflows/`.
- `src/shared/components/` contains reusable interface elements.
- `src/shared/types/`, `src/shared/data/`, and `src/shared/utils/` hold common
  types, initial data, and domain helpers.
- `src/services/` contains browser persistence and API response handling.
- `src/styles/App.css` contains the existing application styles.

## Store & Expenditure

`src/features/store-expenditure/` owns inventory and import-bill types,
components, hooks, calculation utilities, and a localStorage-backed service.
The feature is registered as a section in `AppLayout` and contains Inventory
and Import Bills views. Expenditure is derived from import bills; adding an
import persists its bill, optional initial payment and payment method, and
stock increase together. Further cash or UPI payments are recorded against
the bill; bill details show printable payment history and paid/balance
amounts are derived from payment entries. Other features can call the public
`deductStock(itemId, quantity)` API, which rejects non-positive quantities
and returns a clear error without allowing stock below zero. Removing an
inventory item removes it from active stock tracking while retaining its
import bills as purchase history.

The `@/` alias maps to `src/` in both TypeScript and Vite configuration.

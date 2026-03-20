# Wallet Constellations

## Current State
New project. No existing application files.

## Requested Changes (Diff)

### Add
- Minimal Motoko backend with a single `ping` query returning `{ status: "ok" }`
- Frontend-only data fetching from `https://ledger-api.internetcomputer.org/api/v1/accounts/{principal}/transactions`
- Transaction normalization pipeline (timestamp, from, to, amount in ICP, block index)
- Client-side time-range filtering (7d, 30d, 90d, all)
- Network graph data structure: nodes (principal + counterparties), edges (source, target, tx_count, total_amount)
- Summary computation: total tx, total in, total out, counterparty count
- Force-directed D3.js constellation graph with glowing nodes and weighted edges
- Click node to auto-navigate to that principal (same view), with breadcrumb/back history
- Edge weight toggle: tx_count vs total_amount
- Slider: max counterparties to display
- Overview stats panel: shortened principal + copy, total tx, total in/out, counterparties
- Transaction table: timestamp, from, to, amount, block index
- Chart selector: daily tx count or daily volume (built client-side)
- System status panel: frontend reachable, backend reachable (/ping), explorer reachable, parser working
- CORS error state with proxy URL prompt
- Clean empty states for: invalid principal, empty history, API down
- Top bar: search input, explorer selector (disabled), time-range dropdown

### Modify
- Nothing (new project)

### Remove
- Nothing (new project)

## Implementation Plan
1. Backend: single Motoko actor with `ping` query returning status ok
2. Frontend data layer:
   - `explorerService.ts`: fetch + normalize transactions from ledger API
   - `graphBuilder.ts`: compute nodes, edges, summary from normalized transactions
   - `filters.ts`: client-side time-range filtering
3. Frontend state: principal history stack for back navigation
4. Components:
   - `TopBar`: search, explorer selector (disabled), time-range dropdown
   - `Breadcrumb`: navigation history with back button
   - `OverviewPanel`: stats cards
   - `ConstellationGraph`: D3.js force-directed graph, edge weight toggle, max counterparties slider
   - `TransactionTable`: paginated table with formatted columns
   - `ActivityChart`: recharts line chart with daily tx count / daily volume toggle
   - `StatusPanel`: four connectivity checks
   - `EmptyState`: reusable for no data / CORS error / invalid principal
5. Wire all data through a single `useWallet` hook managing fetch state, normalization, filtering
6. Allowed external API domains: `ledger-api.internetcomputer.org`, `icrc-api.internetcomputer.org`

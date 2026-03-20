# Wallet Constellations

## Current State

The app is a frontend-only ICP wallet visualizer. It fetches ICP transactions from `ledger-api.internetcomputer.org` and renders a force-directed constellation graph. The controls overlay (depth, edge mode, nodes slider, tx limit slider, reset button) is always visible in the top-right corner of the graph. The edge hover tooltip shows only in/out counts (`↑ 4 in`, `↓ 2 out`). There is no legend. All data is ICP-only; no ICRC multi-token support.

## Requested Changes (Diff)

### Add
- **Collapsible controls panel**: A toggle button (chevron icon) in the graph controls overlay that collapses/expands the panel. Collapsed state shows only the toggle button. Expanded (default) shows all controls. State persists while on page.
- **ICRC multi-token support**: On wallet search, fire 62 parallel ICRC calls to `icrc-api.internetcomputer.org/api/v1/ledgers/{canisterId}/accounts/{accountId}/transactions` in addition to the existing ICP call. Cache the ICRC token list (fetched once from `/api/v1/ledgers`). ICP graph shows first; ICRC data merges in when ready. Show a subtle loading indicator while ICRC fetches complete. Discard tokens with 0 transactions. A new `IcrcTransaction` type mirrors `Transaction` but carries `token` symbol and `decimals`. Both ICP and ICRC transactions are stored together and passed to graph/tooltip.
- **Enhanced edge tooltip**: On hover, show:
  - For each token with activity: `↑ In: X txs / Y.YY $TOKEN` and `↓ Out: X txs / Y.YY $TOKEN`
  - Net flow line: `Net: +/-Y.YY $ICP` (ICP only; omit if no ICP)
  - When only ICP: single compact format `↑ In: X txs / Y.YY $ICP`, `↓ Out: X txs / Y.YY $ICP`, `Net: +/-Y.YY $ICP`
- **Legend popover**: A small `?` icon button in the graph area (bottom-left or bottom-right of canvas). On hover/tap, shows a beginner-friendly popover explaining: node colors (blue=center, light blue=depth-1, green=depth-2, purple=depth-3), edge width (more txs or more ICP = thicker), in/out direction, click-to-navigate.

### Modify
- `explorerService.ts`: Add `fetchIcrcTokenList()` (returns array of `{canisterId, symbol, decimals}`) and `fetchIcrcTransactions(canisterId, accountId, limit)`. Both call `icrc-api.internetcomputer.org`.
- `types.ts`: Add `token` and `decimals` fields to `Transaction` (optional, default: `token='ICP'`, `decimals=8`). Add `inAmount`/`outAmount` per token to `GraphEdge` (optional map).
- `graphBuilder.ts`: Update `buildGraph` and `buildMultiDepthGraph` to aggregate per-token amounts on edges (`inAmountByToken`, `outAmountByToken` maps). Edge `total_amount` remains ICP-only for width ranking; ICRC amounts stored separately.
- `ConstellationGraph.tsx`: 
  - Wrap controls in collapsible panel with chevron toggle.
  - Update edge hover tooltip to show per-token amounts and net ICP flow.
  - Add `?` legend icon with popover.
  - Add subtle ICRC loading indicator (small spinner near bottom of graph).
- `useWallet.ts`: After ICP fetch completes and `walletData` is shown, fire ICRC parallel fetches in background. Merge ICRC transactions into `rawTransactions` when ready.

### Remove
- Nothing removed.

## Implementation Plan

1. Update `types.ts`: add optional `token` (string, default 'ICP') and `decimals` (number, default 8) to `Transaction`. Add `inAmountByToken` and `outAmountByToken` (Map<string, number>) to `GraphEdge`.
2. Update `explorerService.ts`: add `fetchIcrcTokenList()` and `fetchIcrcTransactions()`. Both CORS-compatible (no proxy needed). Token list cached in module-level variable.
3. Update `graphBuilder.ts`: track per-token amounts in edge aggregation.
4. Update `useWallet.ts`: after ICP fetch resolves and graph is shown, fire all ICRC token calls in parallel in background; merge results into `rawTransactions` and set `icrcLoading` flag.
5. Update `ConstellationGraph.tsx`:
   a. Add `icrcLoading` prop; show spinner when true.
   b. Wrap all controls in a collapsible div with chevron toggle button.
   c. Update edge hover tooltip with per-token detail and net flow.
   d. Add `?` legend icon with popover.

# Wallet Constellations

## Current State
ICRC tokens consistently fail to show in the graph/tooltip despite multiple prior fixes. Backend shows offline on the live version. The fetch for ICRC transactions only tries the user's raw input as accountId, never the hex fallback. Edge `inAmountByToken`/`outAmountByToken` are typed as optional and the tooltip has a guard condition.

## Requested Changes (Diff)

### Add
- Fallback ICRC fetch: after trying `principal.trim()`, also try the hex account ID derived from the principal if the first fetch returns 0 results
- Increase ICRC token list limit from 100 to 200

### Modify
- `explorerService.ts`: `fetchIcrcTransactions` — after fetching with the principal form, if 0 results and the input is a valid principal, retry with its derived hex account ID
- `explorerService.ts`: `fetchIcrcTokenList` — change `?limit=100` to `?limit=200`
- `graphBuilder.ts`: make `inAmountByToken`, `outAmountByToken`, `inCountByToken`, `outCountByToken` always initialized to `{}` (never undefined) on every edge creation path including cross-edges
- `types.ts`: change the four `ByToken` fields from optional (`?:`) to required on `GraphEdge`
- `ConstellationGraph.tsx`: remove the `hoveredEdgeData.inAmountByToken || hoveredEdgeData.outAmountByToken` guard — always render the per-token breakdown block; it will be empty if no tokens are present
- `StatusPanel.tsx`: make the backend ping failure silent / non-blocking — if ping fails, show a neutral status rather than "Offline" so a backend hiccup doesn't alarm users

### Remove
- Nothing structural removed

## Implementation Plan
1. `types.ts` — make four ByToken fields required (non-optional)
2. `explorerService.ts` — increase token list limit to 200; add hex-fallback retry in `fetchIcrcTransactions`
3. `graphBuilder.ts` — audit every edge creation site and ensure all four ByToken maps are always `{}` at minimum
4. `ConstellationGraph.tsx` — remove conditional guard on token breakdown; always render per-token rows for whatever tokens exist in the maps
5. `StatusPanel.tsx` — make backend offline non-alarming (show as "checking" or neutral when ping fails rather than red Offline)
6. Validate and deploy

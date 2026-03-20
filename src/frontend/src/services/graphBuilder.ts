import type {
  GraphEdge,
  GraphNode,
  Transaction,
  WalletGraph,
  WalletSummary,
} from "../types";

export function buildGraph(
  principal: string,
  transactions: Transaction[],
  maxCounterparties = 20,
): WalletGraph {
  const principalLower = principal.toLowerCase();

  // Aggregate edges
  const edgeMap = new Map<string, GraphEdge>();
  const counterpartyTx = new Map<string, number>();

  for (const tx of transactions) {
    const isFrom = tx.from.toLowerCase() === principalLower;
    const isTo = tx.to.toLowerCase() === principalLower;
    const counterparty = isFrom ? tx.to : isTo ? tx.from : null;
    if (!counterparty) continue;

    const counterpartyLower = counterparty.toLowerCase();
    counterpartyTx.set(
      counterpartyLower,
      (counterpartyTx.get(counterpartyLower) ?? 0) + 1,
    );

    const edgeKey = [principalLower, counterpartyLower].sort().join("|");
    const existing = edgeMap.get(edgeKey);
    if (existing) {
      existing.tx_count += 1;
      existing.total_amount += tx.amount;
    } else {
      edgeMap.set(edgeKey, {
        source: principal,
        target: counterparty,
        tx_count: 1,
        total_amount: tx.amount,
      });
    }
  }

  // Sort counterparties by tx count and limit
  const sortedCounterparties = [...counterpartyTx.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCounterparties)
    .map(([id]) => id);

  const allowedSet = new Set(sortedCounterparties);

  const nodes: GraphNode[] = [
    {
      id: principal,
      isCenter: true,
      txCount: transactions.length,
      totalAmount: transactions.reduce((s, t) => s + t.amount, 0),
    },
    ...sortedCounterparties.map((id) => {
      // Restore original casing from transactions
      const original = transactions.find(
        (t) => t.from.toLowerCase() === id || t.to.toLowerCase() === id,
      );
      const originalId = original
        ? original.from.toLowerCase() === id
          ? original.from
          : original.to
        : id;
      return {
        id: originalId,
        isCenter: false,
        txCount: counterpartyTx.get(id) ?? 0,
        totalAmount: 0,
      };
    }),
  ];

  const edges = [...edgeMap.values()].filter(
    (e) =>
      allowedSet.has(e.source.toLowerCase()) ||
      allowedSet.has(e.target.toLowerCase()),
  );

  return { nodes, edges };
}

export function computeSummary(
  principal: string,
  transactions: Transaction[],
): WalletSummary {
  const principalLower = principal.toLowerCase();
  let totalIn = 0;
  let totalOut = 0;
  const counterparties = new Set<string>();

  for (const tx of transactions) {
    const isTo = tx.to.toLowerCase() === principalLower;
    const isFrom = tx.from.toLowerCase() === principalLower;
    if (isTo) {
      totalIn += tx.amount;
      if (tx.from) counterparties.add(tx.from.toLowerCase());
    } else if (isFrom) {
      totalOut += tx.amount;
      if (tx.to) counterparties.add(tx.to.toLowerCase());
    }
  }

  return {
    totalTx: transactions.length,
    totalIn,
    totalOut,
    counterpartyCount: counterparties.size,
  };
}

export function getTopCounterparties(
  principal: string,
  transactions: Transaction[],
  limit = 5,
): Array<{ address: string; txCount: number; volume: number }> {
  const principalLower = principal.toLowerCase();
  const map = new Map<string, { txCount: number; volume: number }>();

  for (const tx of transactions) {
    const isFrom = tx.from.toLowerCase() === principalLower;
    const isTo = tx.to.toLowerCase() === principalLower;
    const counterparty = isFrom ? tx.to : isTo ? tx.from : null;
    if (!counterparty) continue;
    const existing = map.get(counterparty);
    if (existing) {
      existing.txCount += 1;
      existing.volume += tx.amount;
    } else {
      map.set(counterparty, { txCount: 1, volume: tx.amount });
    }
  }

  return [...map.entries()]
    .sort((a, b) => b[1].txCount - a[1].txCount)
    .slice(0, limit)
    .map(([address, stats]) => ({ address, ...stats }));
}

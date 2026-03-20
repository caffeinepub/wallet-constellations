import type { ExplorerError, Transaction } from "../types";

const LEDGER_API_BASE = "https://ledger-api.internetcomputer.org";

function e8sToIcp(val: string | number | bigint): number {
  const n = typeof val === "bigint" ? Number(val) : Number(val);
  return n / 1e8;
}

function parseTimestamp(raw: string | number | null | undefined): string {
  if (!raw) return new Date().toISOString();
  if (typeof raw === "number") {
    const asMs =
      raw > 1e15
        ? Math.floor(raw / 1e6) // nanoseconds → ms
        : raw > 1e12
          ? raw // already ms
          : raw * 1000; // seconds → ms
    return new Date(asMs).toISOString();
  }
  return new Date(raw).toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTransaction(raw: any): Transaction | null {
  try {
    if (raw?.transaction?.operations) {
      const ops = raw.transaction.operations as any[];
      const txOps = ops.filter(
        (o) => o.type === "TRANSACTION" || o.type === "Transfer",
      );
      const feeOps = ops.filter((o) => o.type === "FEE" || o.type === "Fee");
      if (txOps.length >= 2) {
        const senderOp = txOps.find((o) =>
          String(o.amount?.value ?? "").startsWith("-"),
        );
        const receiverOp = txOps.find(
          (o) => !String(o.amount?.value ?? "").startsWith("-"),
        );
        if (senderOp && receiverOp) {
          const amountRaw = Math.abs(
            Number.parseFloat(receiverOp.amount?.value ?? "0"),
          );
          const decimals = receiverOp.amount?.currency?.decimals ?? 8;
          return {
            timestamp: parseTimestamp(raw.timestamp),
            from: senderOp.account?.address ?? "",
            to: receiverOp.account?.address ?? "",
            amount: amountRaw / 10 ** decimals,
            blockIndex: raw.block_identifier?.index ?? raw.block_index ?? 0,
          };
        }
      }
      const nonFeeOps = ops.filter(
        (o) => !feeOps.includes(o) && o.account?.address,
      );
      if (nonFeeOps.length >= 2) {
        const amountRaw = Math.abs(
          Number.parseFloat(nonFeeOps[0].amount?.value ?? "0"),
        );
        const decimals = nonFeeOps[0].amount?.currency?.decimals ?? 8;
        return {
          timestamp: parseTimestamp(raw.timestamp),
          from: nonFeeOps[0].account?.address ?? "",
          to: nonFeeOps[1].account?.address ?? "",
          amount: amountRaw / 10 ** decimals,
          blockIndex: raw.block_identifier?.index ?? raw.block_index ?? 0,
        };
      }
    }

    if (raw?.from && raw?.to) {
      let amount = 0;
      if (typeof raw.amount === "object" && raw.amount !== null) {
        amount = e8sToIcp(raw.amount.e8s ?? raw.amount.value ?? 0);
      } else if (
        typeof raw.amount === "number" ||
        typeof raw.amount === "string"
      ) {
        const numAmt = Number(raw.amount);
        amount = numAmt > 1000 ? e8sToIcp(numAmt) : numAmt;
      }
      return {
        timestamp: parseTimestamp(
          raw.timestamp ?? raw.created_at_time ?? raw.date,
        ),
        from: String(raw.from),
        to: String(raw.to),
        amount,
        blockIndex: Number(raw.id ?? raw.block_index ?? raw.blockIndex ?? 0),
      };
    }

    const op = raw?.transaction?.operation ?? raw?.transaction?.operations?.[0];
    const transfer = op?.Transfer ?? op?.transfer ?? raw?.transaction?.transfer;
    if (transfer) {
      const amountVal =
        transfer.amount?.e8s ?? transfer.amount?.value ?? transfer.amount ?? 0;
      return {
        timestamp: parseTimestamp(
          raw?.transaction?.created_at_time?.timestamp_nanos ??
            raw?.created_at_time ??
            raw?.timestamp,
        ),
        from: String(
          transfer.from?.address ??
            transfer.from ??
            raw?.transaction?.from ??
            "",
        ),
        to: String(
          transfer.to?.address ?? transfer.to ?? raw?.transaction?.to ?? "",
        ),
        amount: e8sToIcp(amountVal),
        blockIndex: Number(raw?.id ?? raw?.block_index ?? 0),
      };
    }
  } catch {
    // ignore parse errors on individual records
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTransactionArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.transactions)) return data.transactions;
  if (Array.isArray(data?.data?.transactions)) return data.data.transactions;
  if (Array.isArray(data?.blocks)) return data.blocks;
  if (Array.isArray(data?.data?.blocks)) return data.data.blocks;
  if (Array.isArray(data?.result)) return data.result;
  return [];
}

export type FetchResult =
  | { ok: true; transactions: Transaction[] }
  | { ok: false; error: ExplorerError };

export async function fetchWalletTransactions(
  principal: string,
  proxyUrl?: string,
): Promise<FetchResult> {
  if (!principal || principal.trim() === "") {
    return { ok: false, error: "invalid" };
  }

  const base = proxyUrl ? proxyUrl.replace(/\/$/, "") : LEDGER_API_BASE;
  const url = `${base}/api/v1/accounts/${encodeURIComponent(principal.trim())}/transactions`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      err instanceof TypeError &&
      (msg.toLowerCase().includes("failed to fetch") ||
        msg.toLowerCase().includes("networkerror") ||
        msg.toLowerCase().includes("network request failed"))
    ) {
      return { ok: false, error: "cors" };
    }
    return { ok: false, error: "network" };
  }

  if (!response.ok) {
    return { ok: false, error: "http" };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, error: "parse" };
  }

  const rawList = extractTransactionArray(data);
  const transactions: Transaction[] = [];
  for (const raw of rawList) {
    const tx = normalizeTransaction(raw);
    if (tx) transactions.push(tx);
  }

  if (transactions.length === 0 && rawList.length > 0) {
    return { ok: false, error: "parse" };
  }

  return { ok: true, transactions };
}

export async function checkExplorerReachable(): Promise<boolean> {
  try {
    const r = await fetch(`${LEDGER_API_BASE}/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    return r.status < 500;
  } catch {
    try {
      const r2 = await fetch(LEDGER_API_BASE, {
        signal: AbortSignal.timeout(5000),
      });
      return r2.status < 500;
    } catch {
      return false;
    }
  }
}

export function testParser(): boolean {
  try {
    const sample = [
      {
        block_identifier: { index: 1 },
        timestamp: 1700000000000,
        transaction: {
          operations: [
            {
              type: "TRANSACTION",
              account: { address: "aaaaa-aa" },
              amount: {
                value: "-100000000",
                currency: { symbol: "ICP", decimals: 8 },
              },
            },
            {
              type: "TRANSACTION",
              account: { address: "bbbbb-bb" },
              amount: {
                value: "100000000",
                currency: { symbol: "ICP", decimals: 8 },
              },
            },
          ],
        },
      },
    ];
    for (const r of sample) {
      const tx = normalizeTransaction(r);
      if (!tx) return false;
    }
    return true;
  } catch {
    return false;
  }
}

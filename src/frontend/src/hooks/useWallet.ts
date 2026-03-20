import { useCallback, useMemo, useState } from "react";
import { fetchWalletTransactions } from "../services/explorerService";
import { filterByTimeRange } from "../services/filters";
import { buildGraph, computeSummary } from "../services/graphBuilder";
import type {
  ExplorerError,
  TimeRange,
  Transaction,
  WalletData,
} from "../types";

const DEFAULT_MAX_COUNTERPARTIES = 20;

export function useWallet() {
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [currentPrincipal, setCurrentPrincipal] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [maxCounterparties, setMaxCounterparties] = useState(
    DEFAULT_MAX_COUNTERPARTIES,
  );
  const [loading, setLoading] = useState(false);
  const [errorType, setErrorType] = useState<ExplorerError | null>(null);
  const [rawTransactions, setRawTransactions] = useState<Transaction[]>([]);
  const [proxyUrl, setProxyUrl] = useState("");

  const loadPrincipal = useCallback(
    async (principal: string) => {
      setLoading(true);
      setErrorType(null);
      setRawTransactions([]);

      const result = await fetchWalletTransactions(
        principal.trim(),
        proxyUrl || undefined,
      );

      if (result.ok) {
        setRawTransactions(result.transactions);
        if (result.transactions.length === 0) {
          setErrorType("empty");
        }
      } else {
        setErrorType(result.error);
      }

      setLoading(false);
    },
    [proxyUrl],
  );

  const navigate = useCallback(
    async (principal: string) => {
      if (!principal.trim()) return;
      if (currentPrincipal) {
        setHistoryStack((prev) => [...prev, currentPrincipal]);
      }
      setCurrentPrincipal(principal.trim());
      await loadPrincipal(principal.trim());
    },
    [currentPrincipal, loadPrincipal],
  );

  const goBack = useCallback(async () => {
    if (historyStack.length === 0) return;
    const prev = historyStack[historyStack.length - 1];
    setHistoryStack((stack) => stack.slice(0, -1));
    setCurrentPrincipal(prev);
    await loadPrincipal(prev);
  }, [historyStack, loadPrincipal]);

  const reset = useCallback(() => {
    setHistoryStack([]);
    setCurrentPrincipal("");
    setRawTransactions([]);
    setErrorType(null);
    setLoading(false);
  }, []);

  const filteredTransactions = useMemo(
    () => filterByTimeRange(rawTransactions, timeRange),
    [rawTransactions, timeRange],
  );

  const walletData = useMemo<WalletData | null>(() => {
    if (!currentPrincipal || filteredTransactions.length === 0) return null;
    return {
      summary: computeSummary(currentPrincipal, filteredTransactions),
      transactions: filteredTransactions,
      graph: buildGraph(
        currentPrincipal,
        filteredTransactions,
        maxCounterparties,
      ),
    };
  }, [currentPrincipal, filteredTransactions, maxCounterparties]);

  return {
    historyStack,
    currentPrincipal,
    timeRange,
    setTimeRange,
    maxCounterparties,
    setMaxCounterparties,
    loading,
    errorType,
    rawTransactions,
    filteredTransactions,
    walletData,
    navigate,
    goBack,
    reset,
    proxyUrl,
    setProxyUrl,
  };
}

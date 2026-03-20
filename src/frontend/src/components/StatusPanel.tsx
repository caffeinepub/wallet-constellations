import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useActor } from "../hooks/useActor";
import {
  checkExplorerReachable,
  testParser,
} from "../services/explorerService";

type StatusLevel = "ok" | "error" | "checking";

function StatusDot({ status }: { status: StatusLevel }) {
  const color =
    status === "ok"
      ? "bg-neon-green"
      : status === "error"
        ? "bg-neon-red"
        : "bg-neon-amber";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color} ${
        status === "checking" ? "animate-pulse-glow" : ""
      }`}
    />
  );
}

export function StatusPanel() {
  const { actor, isFetching } = useActor();
  const [explorerStatus, setExplorerStatus] = useState<StatusLevel>("checking");
  const [parserStatus, setParserStatus] = useState<StatusLevel>("checking");

  // Backend ping
  const pingQuery = useQuery({
    queryKey: ["status-ping"],
    queryFn: async () => {
      if (!actor) throw new Error("no actor");
      return actor.ping();
    },
    enabled: !!actor && !isFetching,
    retry: false,
    staleTime: 30_000,
  });

  // Explorer reachability check
  useEffect(() => {
    setExplorerStatus("checking");
    checkExplorerReachable().then((ok) =>
      setExplorerStatus(ok ? "ok" : "error"),
    );
  }, []);

  // Parser test
  useEffect(() => {
    setParserStatus(testParser() ? "ok" : "error");
  }, []);

  const backendStatus: StatusLevel = isFetching
    ? "checking"
    : pingQuery.isSuccess
      ? "ok"
      : pingQuery.isError
        ? "error"
        : "checking";

  const rows = [
    { label: "Frontend", status: "ok" as StatusLevel },
    { label: "Backend", status: backendStatus },
    { label: "Explorer", status: explorerStatus },
    { label: "Parser", status: parserStatus },
  ];

  return (
    <div
      className="absolute bottom-4 right-4 z-10 bg-card/90 border border-border rounded-lg p-3 backdrop-blur-sm shadow-lg"
      data-ocid="wallet.panel"
    >
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        System Status
      </div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <StatusDot status={row.status} />
            <span className="text-xs text-muted-foreground w-16">
              {row.label}
            </span>
            <span
              className={`text-xs font-medium ${
                row.status === "ok"
                  ? "text-neon-green"
                  : row.status === "error"
                    ? "text-neon-red"
                    : "text-neon-amber"
              }`}
            >
              {row.status === "ok"
                ? "Online"
                : row.status === "error"
                  ? "Offline"
                  : "Checking…"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

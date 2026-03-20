import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Globe, Search, Star, WifiOff } from "lucide-react";
import { useState } from "react";
import type { ExplorerError } from "../types";

// A known active ICP account identifier (top active account by tx count)
const EXAMPLE_ACCOUNT =
  "da29b27beb16a842882149b5380ff3b20f701c33ca8fddbecdb5201c600e0f0e";

interface EmptyStateProps {
  variant: "search" | ExplorerError;
  onProxySet?: (url: string) => void;
  proxyUrl?: string;
  onSearch?: (query: string) => void;
}

const DECO_STARS = (() => {
  let s = 77;
  const r = () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: 12 }, (_, idx) => ({
    idx,
    x: r() * 100,
    y: r() * 100,
    r: r() * 2.5 + 1,
    op: r() * 0.5 + 0.2,
  }));
})();

export function EmptyState({
  variant,
  onProxySet,
  proxyUrl = "",
  onSearch,
}: EmptyStateProps) {
  const [localProxy, setLocalProxy] = useState(proxyUrl);

  const config = {
    search: {
      icon: <Star className="h-10 w-10 text-neon-blue" />,
      title: "Enter a Principal or Account ID",
      desc: "Search for any ICP wallet to visualize its transaction network as an interactive constellation.",
      hint: null,
      showExample: true,
    },
    empty: {
      icon: <Search className="h-10 w-10 text-muted-foreground" />,
      title: "No Transactions Found",
      desc: "This wallet has no recorded transactions. Most system canisters hold ICP in subaccounts, not the default account. Try a 64-char account identifier instead.",
      hint: null,
      showExample: true,
    },
    cors: {
      icon: <WifiOff className="h-10 w-10 text-neon-amber" />,
      title: "Explorer Access Blocked",
      desc: "This explorer does not allow browser access. Please provide a proxy URL or try from a different network.",
      hint: null,
      showExample: false,
    },
    network: {
      icon: <WifiOff className="h-10 w-10 text-neon-red" />,
      title: "Network Error",
      desc: "Could not reach the explorer API. Check your internet connection and try again.",
      hint: null,
      showExample: false,
    },
    http: {
      icon: <AlertCircle className="h-10 w-10 text-neon-red" />,
      title: "Explorer API Error",
      desc: "The explorer returned an error response. The principal may be invalid or the API may be temporarily unavailable.",
      hint: null,
      showExample: false,
    },
    parse: {
      icon: <AlertCircle className="h-10 w-10 text-neon-amber" />,
      title: "Parse Error",
      desc: "Could not parse the explorer response. The API format may have changed.",
      hint: null,
      showExample: false,
    },
    invalid: {
      icon: <AlertCircle className="h-10 w-10 text-neon-red" />,
      title: "Invalid Principal",
      desc: "Please enter a valid Principal ID or 64-character account identifier.",
      hint: null,
      showExample: true,
    },
  };

  const c = config[variant] ?? config.search;

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-5 px-6 py-10 relative overflow-hidden"
      data-ocid="wallet.empty_state"
    >
      {/* Decorative stars */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <title>Decorative starfield</title>
        {DECO_STARS.map((star) => (
          <circle
            key={star.idx}
            cx={`${star.x}%`}
            cy={`${star.y}%`}
            r={star.r}
            fill="#66C7FF"
            opacity={star.op * 0.4}
          />
        ))}
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-4 max-w-md text-center">
        <div className="p-4 rounded-full border border-border bg-card/50">
          {c.icon}
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {c.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {c.desc}
          </p>
          {c.hint && (
            <p className="text-xs text-muted-foreground/60 mt-2 font-mono">
              {c.hint}
            </p>
          )}
        </div>

        {/* Try active example */}
        {c.showExample && onSearch && (
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-xs text-muted-foreground/70">
              Try a known active account:
            </p>
            <code className="text-xs text-neon-blue/80 font-mono bg-neon-blue/5 border border-neon-blue/20 rounded px-2 py-1 break-all">
              {EXAMPLE_ACCOUNT}
            </code>
            <Button
              data-ocid="wallet.primary_button"
              size="sm"
              onClick={() => onSearch(EXAMPLE_ACCOUNT)}
              className="bg-neon-blue/20 border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/30 hover:border-neon-blue/60 text-xs"
            >
              <Search className="h-3 w-3 mr-1" />
              Load this account
            </Button>
          </div>
        )}

        {/* Proxy URL input for CORS error */}
        {variant === "cors" && onProxySet && (
          <div className="flex gap-2 w-full" data-ocid="wallet.dialog">
            <Input
              data-ocid="wallet.input"
              placeholder="https://your-proxy.example.com"
              value={localProxy}
              onChange={(e) => setLocalProxy(e.target.value)}
              className="text-xs bg-muted/50 border-border"
            />
            <Button
              data-ocid="wallet.save_button"
              size="sm"
              onClick={() => onProxySet(localProxy)}
              className="shrink-0 bg-neon-blue/20 border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/30"
            >
              <Globe className="h-3.5 w-3.5 mr-1" />
              Use Proxy
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

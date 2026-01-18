"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  RefreshCw,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

type GraphResponse = {
  ok: boolean;
  state: GraphState;
};

type GraphState = {
  market: {
    market_id: string;
    market_name: string;
    market_type: string;
    market_values: Record<string, number>;
    top_prob?: number;
  };
  threshold: number;
  prefilter_passed: boolean;
  oracle?: {
    shoppable: boolean;
    reason: string;
    category: string;
  };
  ideas: Array<{
    idea_id: string;
    title: string;
    description: string;
    tags: string[];
  }>;
  risk: Array<{
    idea_id: string;
    allowed: boolean;
    score: number;
    flags: string[];
    notes: string;
  }>;
  final_products: Array<{
    idea_id: string;
    title: string;
    price: number;
    description: string;
    tags: string[];
    image_prompt: string;
    image_data_url?: string; // should be like "/generated/abc.png"
  }>;
  shopify_result?: {
    mode?: string;
    created?: Array<{
      title: string;
      productId: string;
      variantId: string;
      price: string;
      imageUrl?: string;
      imageAlt?: string;
      }>;
    errors?: any[];
  };
  log: string[];
};

const SAMPLE_MARKETS = [
  { id: "m1", label: "m1" },
  { id: "m2", label: "m2" },
  { id: "m3", label: "m3" },
  { id: "m4", label: "m4" },
  { id: "m5", label: "m5" },
  { id: "m6", label: "m6" },
];

type CacheEntry = {
  ts: number;
  resp: GraphResponse;
  durationMs?: number;
};

type CacheMap = Record<string, CacheEntry>;

const CACHE_KEY = "prophet_run_cache_v1";
const LAST_MARKET_KEY = "prophet_last_market_v1";

function pct(n: number | undefined) {
  if (typeof n !== "number") return "n/a";
  return `${Math.round(n * 100)}%`;
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusFor(
  state?: GraphState
): "idle" | "prefilter_fail" | "not_shoppable" | "shoppable" {
  if (!state) return "idle";
  if (!state.prefilter_passed) return "prefilter_fail";
  if (state.oracle && !state.oracle.shoppable) return "not_shoppable";
  if (state.oracle && state.oracle.shoppable) return "shoppable";
  return "idle";
}

function statusPill(status: ReturnType<typeof statusFor>) {
  if (status === "shoppable")
    return {
      label: "shoppable",
      icon: CheckCircle2,
      cls: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30",
    };
  if (status === "not_shoppable")
    return {
      label: "not shoppable",
      icon: XCircle,
      cls: "bg-red-500/15 text-red-200 ring-1 ring-red-500/30",
    };
  if (status === "prefilter_fail")
    return {
      label: "prefilter stopped",
      icon: AlertTriangle,
      cls: "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30",
    };
  return {
    label: "idle",
    icon: Clock,
    cls: "bg-white/5 text-muted-foreground ring-1 ring-white/10",
  };
}

function lineClass(line: string) {
  if (line.startsWith("[PREFILTER]")) return "text-sky-200/90";
  if (line.startsWith("[ORACLE]")) return "text-emerald-200/90";
  if (line.startsWith("[IDEAS]")) return "text-violet-200/90";
  if (line.startsWith("[RISK]")) return "text-amber-200/90";
  if (line.startsWith("[PRODUCTS]")) return "text-cyan-200/90";
  if (line.startsWith("[IMAGES]")) return "text-pink-200/90";
  if (line.startsWith("[SHOPIFY]")) return "text-lime-200/90";
  if (line.startsWith("[STOP]")) return "text-red-200/90";
  return "text-emerald-200/90";
}

function stageStatus(state: GraphState | undefined) {
  const hasOracle = !!state?.oracle;
  const hasIdeas = (state?.ideas?.length ?? 0) > 0;
  const hasRisk = (state?.risk?.length ?? 0) > 0;
  const hasProducts = (state?.final_products?.length ?? 0) > 0;
  const hasImages = (state?.final_products ?? []).some((p) => !!p.image_data_url);
  const hasShopify =
    !!state?.shopify_result &&
    (state.shopify_result.created?.length ?? 0) +
      (state.shopify_result.errors?.length ?? 0) >
      0;

  return [
    {
      key: "prefilter",
      label: "Prefilter",
      status: !state ? "idle" : state.prefilter_passed ? "done" : "blocked",
      hint: !state ? "" : state.prefilter_passed ? "passed" : "stopped",
    },
    {
      key: "oracle",
      label: "Oracle",
      status: !state
        ? "idle"
        : hasOracle
        ? state.oracle?.shoppable
          ? "done"
          : "blocked"
        : state.prefilter_passed
        ? "pending"
        : "idle",
      hint: !hasOracle ? "" : state?.oracle?.shoppable ? "shoppable" : "not shoppable",
    },
    {
      key: "ideas",
      label: "Ideas",
      status: !state
        ? "idle"
        : hasIdeas
        ? "done"
        : hasOracle && state.oracle?.shoppable
        ? "pending"
        : "idle",
      hint: hasIdeas ? `${state?.ideas.length} ideas` : "",
    },
    {
      key: "risk",
      label: "Risk",
      status: !state ? "idle" : hasRisk ? "done" : hasIdeas ? "pending" : "idle",
      hint: hasRisk ? `${state?.risk.length} scored` : "",
    },
    {
      key: "products",
      label: "Products",
      status: !state
        ? "idle"
        : hasProducts
        ? "done"
        : hasRisk
        ? "pending"
        : "idle",
      hint: hasProducts ? `${state?.final_products.length} built` : "",
    },
    {
      key: "images",
      label: "Images",
      status: !state ? "idle" : hasImages ? "done" : hasProducts ? "pending" : "idle",
      hint: hasImages ? "ready" : "",
    },
    {
      key: "shopify",
      label: "Shopify",
      status: !state
        ? "idle"
        : hasShopify
        ? "done"
        : hasImages
        ? "pending"
        : "idle",
      hint: hasShopify ? `${state?.shopify_result?.created?.length ?? 0} created` : "",
    },
  ] as const;
}

const STAGES = ["ALL", "PREFILTER", "ORACLE", "IDEAS", "RISK", "PRODUCTS", "IMAGES", "SHOPIFY", "STOP"] as const;
type Stage = (typeof STAGES)[number];

function stageFromLine(line: string): Stage {
  if (line.startsWith("[PREFILTER]")) return "PREFILTER";
  if (line.startsWith("[ORACLE]")) return "ORACLE";
  if (line.startsWith("[IDEAS]")) return "IDEAS";
  if (line.startsWith("[RISK]")) return "RISK";
  if (line.startsWith("[PRODUCTS]")) return "PRODUCTS";
  if (line.startsWith("[IMAGES]")) return "IMAGES";
  if (line.startsWith("[SHOPIFY]")) return "SHOPIFY";
  if (line.startsWith("[STOP]")) return "STOP";
  return "ALL";
}

function groupByStage(lines: string[]) {
  const groups = new Map<Stage, string[]>();
  for (const line of lines) {
    const st = stageFromLine(line);
    if (!groups.has(st)) groups.set(st, []);
    groups.get(st)!.push(line);
  }
  return groups;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Stepper({ state, running }: { state: GraphState | undefined; running: boolean }) {
  const stages = stageStatus(state);

  function dotClass(status: string) {
    switch (status) {
      case "done":
        return "bg-emerald-500/70 ring-1 ring-emerald-500/40";
      case "blocked":
        return "bg-rose-500/70 ring-1 ring-rose-500/40";
      case "pending":
        return "bg-amber-500/70 ring-1 ring-amber-500/40";
      default:
        return "bg-muted ring-1 ring-border";
    }
  }

  function chipClass(status: string) {
    switch (status) {
      case "done":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
      case "blocked":
        return "border-rose-500/30 bg-rose-500/10 text-rose-200";
      case "pending":
        return "border-amber-500/30 bg-amber-500/10 text-amber-200";
      default:
        return "border-border bg-muted/30 text-muted-foreground";
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Pipeline</p>
        <Badge variant="outline" className={running ? "animate-pulse" : ""}>
          {running ? "running" : state ? "ready" : "idle"}
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {stages.map((s, idx) => (
          <div key={s.key} className="relative">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${chipClass(s.status)}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${dotClass(s.status)}`} />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{s.label}</div>
                <div className="truncate text-[11px] opacity-80">{s.hint || (s.status === "pending" ? "…" : "")}</div>
              </div>
            </div>

            {idx !== stages.length - 1 && (
              <div className="hidden lg:block absolute -right-2 top-1/2 h-px w-4 -translate-y-1/2 bg-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [marketId, setMarketId] = useState(SAMPLE_MARKETS[0].id);
  const [running, setRunning] = useState(false);

  const [resp, setResp] = useState<GraphResponse | null>(null);
  const [cache, setCache] = useState<CacheMap>({});
  const [error, setError] = useState<string | null>(null);

  // terminal state (already added by you)
  const [termQuery, setTermQuery] = useState("");
  const [termStage, setTermStage] = useState<Stage>("ALL");
  const [termAutoScroll, setTermAutoScroll] = useState(true);
  const [termWrap, setTermWrap] = useState(false);
  const [termGroup, setTermGroup] = useState(false);
  const [termCollapsed, setTermCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const state = resp?.state;

  const terminalLines = useMemo(() => state?.log ?? ["[idle]"], [state?.log]);
  const termEndRef = useRef<HTMLDivElement | null>(null);

  const filteredTerminalLines = useMemo(() => {
    const q = termQuery.trim().toLowerCase();
    return terminalLines.filter((line) => {
      const st = stageFromLine(line);
      if (termStage !== "ALL" && st !== termStage) return false;
      if (!q) return true;
      return line.toLowerCase().includes(q);
    });
  }, [terminalLines, termQuery, termStage]);

  const groupedTerminal = useMemo(() => groupByStage(filteredTerminalLines), [filteredTerminalLines]);

  useEffect(() => {
    if (!termAutoScroll) return;
    termEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredTerminalLines, termAutoScroll]);

  // load cache and last market on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as CacheMap) : {};
      setCache(parsed);

      const last = localStorage.getItem(LAST_MARKET_KEY);
      if (last && SAMPLE_MARKETS.some((m) => m.id === last)) {
        setMarketId(last);
        if (parsed[last]?.resp) setResp(parsed[last].resp);
      } else {
        if (parsed[SAMPLE_MARKETS[0].id]?.resp) setResp(parsed[SAMPLE_MARKETS[0].id].resp);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IMPORTANT FIX: when market changes, do not keep old state if no cache hit
  useEffect(() => {
    try {
      localStorage.setItem(LAST_MARKET_KEY, marketId);
    } catch {
      // ignore
    }

    const hit = cache[marketId]?.resp ?? null;
    setResp(hit);

    // optional: reset terminal filters per market switch so it feels fresh
    setTermQuery("");
    setTermStage("ALL");
  }, [marketId, cache]);

  const top = useMemo(() => {
    if (!state?.market?.market_values) return undefined;
    const vals = Object.values(state.market.market_values);
    if (vals.length === 0) return undefined;
    return Math.max(...vals);
  }, [state?.market?.market_values]);

  const riskById = useMemo(() => {
    const m = new Map<string, GraphState["risk"][number]>();
    (state?.risk ?? []).forEach((r) => m.set(r.idea_id, r));
    return m;
  }, [state?.risk]);

  const shopifyImageByTitle = useMemo(() => {
    const m = new Map<string, { url?: string; alt?: string }>();
    (state?.shopify_result?.created ?? []).forEach((c) => {
      m.set(c.title, { url: c.imageUrl, alt: c.imageAlt });
    });
    return m;
  }, [state?.shopify_result?.created]);

  const currentStatus = statusFor(state);
  const pill = statusPill(currentStatus);

  const lastRunMeta = cache[marketId];

  async function copyLogs() {
    const ok = await copyToClipboard(filteredTerminalLines.join("\n"));
    setCopied(ok);
    if (ok) setTimeout(() => setCopied(false), 1200);
  }

  async function runOnce() {
    setRunning(true);
    setError(null);

    const t0 = performance.now();
    try {
      const r = await fetch(`/api/proxy/run_one/${marketId}`, {
        method: "POST",
        headers: { accept: "application/json" },
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as GraphResponse;
      const dt = Math.round(performance.now() - t0);

      setResp(data);

      const entry: CacheEntry = { ts: Date.now(), resp: data, durationMs: dt };
      const next: CacheMap = { ...cache, [marketId]: entry };
      setCache(next);

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  function loadFromCache(id: string) {
    setMarketId(id);
    const hit = cache[id]?.resp ?? null;
    setResp(hit);
  }

  function clearCache() {
    const next: CacheMap = {};
    setCache(next);

    // clears progress stepper (state becomes undefined)
    setResp(null);
    setError(null);

    // clear terminal UX too
    setTermQuery("");
    setTermStage("ALL");
    setTermAutoScroll(true);
    setTermWrap(false);
    setTermGroup(false);
    setTermCollapsed({});
    setCopied(false);

    setMarketId(SAMPLE_MARKETS[0].id);

    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      // ignore
    }
  }

  function toggleCollapsed(stage: Stage) {
    setTermCollapsed((prev) => ({ ...prev, [stage]: !prev[stage] }));
  }

  const groupOrder: Stage[] = ["PREFILTER", "ORACLE", "IDEAS", "RISK", "PRODUCTS", "IMAGES", "SHOPIFY", "STOP", "ALL"];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center overflow-hidden">
              <img
                src="/prophet-1.png"
                alt="Prophet"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Prophet</h1>
              <p className="text-sm text-muted-foreground">Event-driven commerce engine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
              <span className="text-xs text-muted-foreground">Market</span>
              <select
                value={marketId}
                onChange={(e) => setMarketId(e.target.value)}
                className="bg-background text-sm outline-none"
              >
                {SAMPLE_MARKETS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={runOnce} disabled={running} className="gap-2">
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run
            </Button>
          </div>
        </header>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-destructive">Run failed</p>
              <p className="mt-1 text-xs text-destructive/90 wrap-break-word">{error}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={runOnce} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Stepper state={state} running={running} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Run history sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Runs
                <Button variant="ghost" size="sm" onClick={clearCache} className="text-xs">
                  clear
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 sm:hidden">
                <span className="text-xs text-muted-foreground">Market</span>
                <select
                  value={marketId}
                  onChange={(e) => setMarketId(e.target.value)}
                  className="bg-transparent text-sm outline-none"
                >
                  {SAMPLE_MARKETS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                {SAMPLE_MARKETS.map((m) => {
                  const entry = cache[m.id];
                  const st = entry?.resp?.state;
                  const s = statusFor(st);
                  const p = statusPill(s);
                  const active = m.id === marketId;

                  return (
                    <button
                      key={m.id}
                      onClick={() => loadFromCache(m.id)}
                      className={[
                        "w-full text-left rounded-xl border px-3 py-3 transition",
                        active ? "bg-white/5 border-white/15" : "bg-card hover:bg-white/5 border-white/10",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">{m.label}</div>
                        <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${p.cls}`}>
                          <p.icon className="h-3.5 w-3.5" />
                          {p.label}
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted-foreground">
                        {entry ? (
                          <span>
                            last run {formatTime(entry.ts)}
                            {typeof entry.durationMs === "number" ? ` · ${Math.round(entry.durationMs / 1000)}s` : ""}
                          </span>
                        ) : (
                          <span>not run yet</span>
                        )}
                      </div>

                      {st?.market?.market_name && (
                        <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {st.market.market_name}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <Separator />

              <div
                className={[
                  "rounded-xl border p-3",
                  currentStatus === "shoppable"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : currentStatus === "not_shoppable"
                    ? "border-red-500/30 bg-red-500/10"
                    : currentStatus === "prefilter_fail"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-white/10 bg-card",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">Current</div>
                  <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${pill.cls}`}>
                    <pill.icon className="h-3.5 w-3.5" />
                    {pill.label}
                  </div>
                </div>

                {state ? (
                  <>
                    <div className="mt-2 text-xs text-muted-foreground">
                      threshold {state.threshold} · top prob {pct(top)}
                    </div>

                    {state.oracle && (
                      <div className="mt-3 rounded-xl border bg-black/10 p-3">
                        <p className="text-xs text-muted-foreground">Category</p>
                        <p className="text-sm">{state.oracle.category}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Reason</p>
                        <p className="text-sm">{state.oracle.reason}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Run a market to populate details.</p>
                )}
              </div>

              {lastRunMeta?.durationMs !== undefined && (
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  Last run took {Math.round(lastRunMeta.durationMs / 1000)}s
                </div>
              )}
            </CardContent>
          </Card>

          {/* Main panel */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                Agent Terminal

                {/* STEP 4–6: terminal controls */}
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <input
                    value={termQuery}
                    onChange={(e) => setTermQuery(e.target.value)}
                    placeholder="search logs"
                    className="h-9 w-40 rounded-xl border bg-card px-3 text-sm outline-none"
                  />

                  <select
                    value={termStage}
                    onChange={(e) => setTermStage(e.target.value as Stage)}
                    className="h-9 rounded-xl border bg-card px-2 text-sm outline-none"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>

                  <Button
                    variant={termGroup ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setTermGroup((v) => !v)}
                  >
                    {termGroup ? "grouped" : "flat"}
                  </Button>

                  <Button
                    variant={termWrap ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setTermWrap((v) => !v)}
                  >
                    {termWrap ? "wrap" : "no wrap"}
                  </Button>

                  <Button
                    variant={termAutoScroll ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setTermAutoScroll((v) => !v)}
                  >
                    {termAutoScroll ? "autoscroll" : "manual"}
                  </Button>

                  <Button variant="outline" size="sm" onClick={copyLogs}>
                    {copied ? "copied" : "copy"}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>

            <CardContent>
              {/* STEP 4–6: render filtered + grouped logs, use termEndRef */}
              <ScrollArea className="h-90 rounded-xl border bg-black/40 p-3">
                <div className={`space-y-1 font-mono text-xs ${termWrap ? "whitespace-pre-wrap wrap-break-word" : "whitespace-pre"}`}>
                  {!termGroup ? (
                    <>
                      {filteredTerminalLines.map((line, idx) => (
                        <div key={idx} className={lineClass(line)}>
                          {line}
                        </div>
                      ))}
                      <div ref={termEndRef} />
                    </>
                  ) : (
                    <>
                      {groupOrder
                        .filter((st) => groupedTerminal.has(st))
                        .map((st) => {
                          const lines = groupedTerminal.get(st) ?? [];
                          const collapsed = !!termCollapsed[st];

                          return (
                            <div key={st} className="mb-3">
                              <button
                                onClick={() => toggleCollapsed(st)}
                                className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">{st}</Badge>
                                  <span className="text-xs text-muted-foreground">{lines.length} lines</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {collapsed ? "expand" : "collapse"}
                                </span>
                              </button>

                              {!collapsed && (
                                <div className="mt-2 space-y-1 px-1">
                                  {lines.map((line, idx) => (
                                    <div key={`${st}-${idx}`} className={lineClass(line)}>
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                      <div ref={termEndRef} />
                    </>
                  )}
                </div>
              </ScrollArea>

              <Tabs defaultValue="products" className="mt-4">
                <TabsList>
                  <TabsTrigger value="products">Products ({state?.final_products?.length ?? 0})</TabsTrigger>
                  <TabsTrigger value="ideas">Ideas ({state?.ideas?.length ?? 0})</TabsTrigger>
                  <TabsTrigger value="risk">Risk ({state?.risk?.length ?? 0})</TabsTrigger>
                  <TabsTrigger value="shopify">Shopify</TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="mt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {(state?.final_products ?? []).map((p) => {
                      const r = riskById.get(p.idea_id);
                      return (
                        <Card key={p.idea_id} className="overflow-hidden">
                          <CardHeader>
                            <CardTitle className="text-base flex items-center justify-between gap-3">
                              <span className="truncate">{p.title}</span>
                              <div className="flex items-center gap-2">
                                {r && (
                                  <Badge variant={r.allowed ? "default" : "secondary"}>
                                    {r.allowed ? "allowed" : "blocked"} · {r.score}
                                  </Badge>
                                )}
                                <Badge variant="outline">${p.price}</Badge>
                              </div>
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="space-y-3">
                            {/* <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted/30">
                              {(() => {
                                const shopifyImg = shopifyImageByTitle.get(p.title);
                                const hasCreatedInShopify = (state?.shopify_result?.created?.length ?? 0) > 0;

                                const imgSrc =
                                  shopifyImg?.url ??
                                  (!hasCreatedInShopify && p.image_data_url ? `/api/proxy${p.image_data_url}` : null);

                                return imgSrc ? (
                                  // eslint-disable-next-line @next/next/no-img-element 
                                  <img
                                    src={imgSrc}
                                    alt={shopifyImg?.alt ?? p.title}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                    no image yet
                                  </div>
                                );
                              })()}
                            </div> */}


                            <p className="text-sm text-muted-foreground">{p.description}</p>

                            <div className="flex flex-wrap gap-2">
                              {p.tags?.map((t) => (
                                <Badge key={t} variant="secondary">
                                  {t}
                                </Badge>
                              ))}
                            </div>

                            {r && (r.flags?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {r.flags.map((f) => (
                                  <Badge key={f} variant="destructive">
                                    {f}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}

                    {(state?.final_products?.length ?? 0) === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No products yet. Oracle may have stopped the run or upstream agents returned none.
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="ideas" className="mt-4">
                  <div className="space-y-3">
                    {(state?.ideas ?? []).map((i) => (
                      <div key={i.idea_id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{i.title}</p>
                          <Badge variant="outline">{i.idea_id}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{i.description}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {i.tags?.map((t) => (
                            <Badge key={t} variant="secondary">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}

                    {(state?.ideas?.length ?? 0) === 0 && (
                      <div className="text-sm text-muted-foreground">No ideas generated for this run.</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="risk" className="mt-4">
                  <div className="space-y-3">
                    {(state?.risk ?? []).map((r) => (
                      <div key={r.idea_id} className="rounded-xl border bg-card p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{r.idea_id}</Badge>
                            <Badge variant={r.allowed ? "default" : "secondary"}>
                              {r.allowed ? "allowed" : "blocked"}
                            </Badge>
                          </div>
                          <Badge variant="outline">score {r.score}</Badge>
                        </div>

                        <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {(r.flags ?? []).map((f) => (
                            <Badge key={f} variant="destructive">
                              {f}
                            </Badge>
                          ))}
                          {(r.flags?.length ?? 0) === 0 && <Badge variant="secondary">no flags</Badge>}
                        </div>
                      </div>
                    ))}

                    {(state?.risk?.length ?? 0) === 0 && (
                      <div className="text-sm text-muted-foreground">No risk results for this run.</div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="shopify" className="mt-4">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(state?.shopify_result ?? {}, null, 2)}</pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

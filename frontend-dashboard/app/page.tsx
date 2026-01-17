"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, RefreshCw } from "lucide-react";

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
    image_data_url?: string;
  }>;
  shopify_result?: {
    mode?: string;
    created?: any[];
    errors?: any[];
  };
  log: string[];
};

const SAMPLE_MARKETS = [
  { id: "m1", label: "m1" },
  { id: "m2", label: "m2" },
  { id: "m3", label: "m3" },
];

function pct(n: number | undefined) {
  if (typeof n !== "number") return "n/a";
  return `${Math.round(n * 100)}%`;
}

export default function Home() {
  const [marketId, setMarketId] = useState(SAMPLE_MARKETS[0].id);
  const [running, setRunning] = useState(false);
  const [resp, setResp] = useState<GraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = resp?.state;

  const top = useMemo(() => {
    if (!state?.market?.market_values) return undefined;
    const vals = Object.values(state.market.market_values);
    if (vals.length === 0) return undefined;
    return Math.max(...vals);
  }, [state?.market?.market_values]);

  async function runOnce() {
    setRunning(true);
    setError(null);
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
      setResp(data);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-300 font-semibold">P</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Prophet</h1>
              <p className="text-sm text-muted-foreground">
                Event-driven commerce engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
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

            <Button onClick={runOnce} disabled={running} className="gap-2">
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run
            </Button>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Market
                {state ? (
                  <Badge variant={state.prefilter_passed ? "default" : "secondary"}>
                    prefilter {state.prefilter_passed ? "pass" : "stop"}
                  </Badge>
                ) : (
                  <Badge variant="secondary">idle</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!state ? (
                <p className="text-sm text-muted-foreground">
                  Click Run to execute the graph for the selected market.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{state.market.market_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {state.market.market_type} · top prob {pct(top)}
                    </p>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    {Object.entries(state.market.market_values).map(([k, v]) => (
                      <Badge key={k} variant="outline">
                        {k}: {pct(v)}
                      </Badge>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Oracle</span>
                      {state.oracle ? (
                        <Badge variant={state.oracle.shoppable ? "default" : "secondary"}>
                          {state.oracle.shoppable ? "shoppable" : "not shoppable"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">n/a</Badge>
                      )}
                    </div>

                    {state.oracle && (
                      <div className="rounded-xl border bg-muted/30 p-3">
                        <p className="text-xs text-muted-foreground">Category</p>
                        <p className="text-sm">{state.oracle.category}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Reason</p>
                        <p className="text-sm">{state.oracle.reason}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {error && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive">Error</p>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-destructive/90">
                    {error}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Agent Terminal</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-90 rounded-xl border bg-black/40 p-3">
                <div className="space-y-1 font-mono text-xs">
                  {(state?.log ?? ["[idle]"]).map((line, idx) => (
                    <div key={idx} className="text-emerald-200/90">
                      {line}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <Tabs defaultValue="products" className="mt-4">
                <TabsList>
                  <TabsTrigger value="products">
                    Products ({state?.final_products?.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="ideas">
                    Ideas ({state?.ideas?.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="risk">
                    Risk ({state?.risk?.length ?? 0})
                  </TabsTrigger>
                  <TabsTrigger value="shopify">Shopify</TabsTrigger>
                </TabsList>

                <TabsContent value="products" className="mt-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {(state?.final_products ?? []).map((p) => (
                      <Card key={p.idea_id} className="overflow-hidden">
                        <CardHeader>
                          <CardTitle className="text-base flex items-center justify-between gap-3">
                            <span className="truncate">{p.title}</span>
                            <Badge variant="outline">${p.price}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="aspect-square w-full overflow-hidden rounded-xl border bg-muted/30">
                            {p.image_data_url ? (
                              // data url or placeholder url
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={p.image_data_url}
                                alt={p.title}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                                no image yet
                              </div>
                            )}
                          </div>

                          <p className="text-sm text-muted-foreground">{p.description}</p>

                          <div className="flex flex-wrap gap-2">
                            {p.tags?.map((t) => (
                              <Badge key={t} variant="secondary">
                                {t}
                              </Badge>
                            ))}
                          </div>

                          <div className="rounded-xl border bg-muted/30 p-3">
                            <p className="text-xs text-muted-foreground">Image prompt</p>
                            <p className="text-sm">{p.image_prompt}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}

                    {(state?.final_products?.length ?? 0) === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No products yet. Either Oracle stopped the run or upstream agents returned none.
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
                          {(r.flags?.length ?? 0) === 0 && (
                            <Badge variant="secondary">no flags</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="shopify" className="mt-4">
                  <div className="rounded-xl border bg-muted/30 p-4">
                    <pre className="whitespace-pre-wrap text-xs">
                      {JSON.stringify(state?.shopify_result ?? {}, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <footer className="mt-10 text-xs text-muted-foreground">
          Tip: open FastAPI docs at <span className="text-emerald-300">/docs</span> and run markets here for the demo.
        </footer>
      </div>
    </div>
  );
}

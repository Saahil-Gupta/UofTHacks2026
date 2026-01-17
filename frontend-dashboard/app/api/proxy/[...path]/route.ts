import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

async function forward(req: NextRequest, path: string | string[] | undefined) {
  const parts = Array.isArray(path) ? path : path ? [path] : [];
  const url = new URL(req.url);

  const target = `${BACKEND_URL}/${parts.join("/")}${url.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: body ? Buffer.from(body) : undefined,
  });

  // IMPORTANT: do not .text() for images
  const buf = await res.arrayBuffer();

  const outHeaders = new Headers(res.headers);
  // Allow browser to render images
  outHeaders.set("cache-control", "no-store");

  return new NextResponse(buf, {
    status: res.status,
    headers: outHeaders,
  });
}

export async function GET(req: NextRequest, ctx: any) {
    const params = await ctx.params;
    return forward(req, params.path);
}

export async function POST(req: NextRequest, ctx: any) {
    const params = await ctx.params;
    return forward(req, params.path);
}

export async function PUT(req: NextRequest, ctx: any) {
    const params = await ctx.params;
    return forward(req, params.path);
}

export async function DELETE(req: NextRequest, ctx: any) {
    const params = await ctx.params;
    return forward(req, params.path);
}

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

function toParts(p: string | string[] | undefined): string[] {
    if (!p) return [];
    return Array.isArray(p) ? p : [p];
}

async function forward(req: NextRequest, partsRaw: string | string[] | undefined) {
    const parts = toParts(partsRaw);
    const incoming = new URL(req.url);
    const target = `${BACKEND_URL}/${parts.join("/")}${incoming.search}`;

    const headers = new Headers(req.headers);
    headers.delete("host");

    const body =
        req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

    const res = await fetch(target, { method: req.method, headers, body });

    const contentType = res.headers.get("content-type") ?? "application/json";
    const text = await res.text();

    return new NextResponse(text, {
        status: res.status,
        headers: { "content-type": contentType },
    });
}

type Ctx = { params: Promise<{ path?: string | string[] }> };

export async function GET(req: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return forward(req, path);
    }
    export async function POST(req: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return forward(req, path);
    }
    export async function PUT(req: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return forward(req, path);
    }
    export async function DELETE(req: NextRequest, ctx: Ctx) {
    const { path } = await ctx.params;
    return forward(req, path);
}

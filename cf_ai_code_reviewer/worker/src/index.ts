import { DurableObject } from "cloudflare:workers";

export interface Env {
  AI: Ai;
  CODE_REVIEW_SESSION: DurableObjectNamespace;
}

// ─── Durable Object: Per-session memory & state ───────────────────────────
export class CodeReviewSession extends DurableObject {
  private history: { role: string; content: string }[] = [];
  private sessionMeta: { created: number; reviewCount: number } = {
    created: Date.now(),
    reviewCount: 0,
  };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Rehydrate from storage
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<typeof this.history>("history");
      const meta = await this.ctx.storage.get<typeof this.sessionMeta>("meta");
      if (stored) this.history = stored;
      if (meta) this.sessionMeta = meta;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/chat" && request.method === "POST") {
      const { message, code } = await request.json<{
        message: string;
        code?: string;
      }>();

      // Build user content
      let userContent = message;
      if (code) {
        userContent = `${message}\n\n\`\`\`\n${code}\n\`\`\``;
        this.sessionMeta.reviewCount++;
      }

      this.history.push({ role: "user", content: userContent });

      const systemPrompt = `You are an expert code reviewer and debugger with deep knowledge of security vulnerabilities, performance patterns, and clean code principles. 

When reviewing code:
1. Start with a brief summary of what the code does
2. List issues by severity: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | 💡 Suggestion
3. For each issue: explain the problem, why it matters, and provide a fixed code snippet
4. End with an overall score (1-10) and 3 key takeaways

For follow-up questions, reference the code already shared in this session.
Be direct, specific, and educational. Format using markdown.`;

      const messages = [
        ...this.history.slice(-10), // last 10 turns for context window
      ];

      // Call Workers AI
      const aiResponse = await (this.env as Env).AI.run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        {
          system: systemPrompt,
          messages,
        } as Parameters<Ai["run"]>[1]
      );

      const assistantMessage =
        typeof aiResponse === "object" && "response" in aiResponse
          ? (aiResponse as { response: string }).response
          : JSON.stringify(aiResponse);

      this.history.push({ role: "assistant", content: assistantMessage });

      // Persist to durable storage
      await this.ctx.storage.put("history", this.history);
      await this.ctx.storage.put("meta", this.sessionMeta);

      return Response.json({
        response: assistantMessage,
        reviewCount: this.sessionMeta.reviewCount,
        historyLength: this.history.length,
      });
    }

    if (url.pathname === "/history" && request.method === "GET") {
      return Response.json({
        history: this.history,
        meta: this.sessionMeta,
      });
    }

    if (url.pathname === "/reset" && request.method === "POST") {
      this.history = [];
      this.sessionMeta = { created: Date.now(), reviewCount: 0 };
      await this.ctx.storage.put("history", this.history);
      await this.ctx.storage.put("meta", this.sessionMeta);
      return Response.json({ ok: true });
    }

    return new Response("Not found", { status: 404 });
  }
}

// ─── Main Worker: Routes requests to Durable Object ──────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Expect: /api/<sessionId>/<action>
    if (pathParts[0] !== "api" || pathParts.length < 3) {
      return new Response(
        JSON.stringify({ error: "Use /api/<sessionId>/<action>" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionId = pathParts[1];
    const action = pathParts[2];

    // Route to Durable Object
    const id = env.CODE_REVIEW_SESSION.idFromName(sessionId);
    const stub = env.CODE_REVIEW_SESSION.get(id);

    const doUrl = new URL(request.url);
    doUrl.pathname = `/${action}`;

    const doRequest = new Request(doUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    const doResponse = await stub.fetch(doRequest);
    const body = await doResponse.text();

    return new Response(body, {
      status: doResponse.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  },
};

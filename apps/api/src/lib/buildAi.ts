import { log } from "./logger";

// The builder's model call (routes/aiBuild.ts). Best model first; the next one
// is tried when a call fails or comes back without the tool call.
//
// Opus and Sonnet 5.5 refuse a forced tool_choice ("tool" and "any" are not
// supported for those models), so every call offers the one tool on "auto" and
// the system prompt says to answer only by calling it. The system prompt (the
// catalog) is the same on every call, so it is cached.

export type BuildTool = { name: string; description: string; input_schema: Record<string, any> };

function models(): string[] {
  const first = (process.env.AI_BUILD_MODEL || "claude-opus-5-5").trim();
  return [first, "claude-haiku-5-5"].filter((m, i, a) => m && a.indexOf(m) === i);
}

export async function runBuilder(
  ai: any,
  args: { kind: string; system: string; tool: BuildTool; user: string; maxTokens: number },
): Promise<{ input: any; model: string } | null> {
  for (const model of models()) {
    const t0 = Date.now();
    try {
      const res = await ai.messages.create(
        {
          model,
          max_tokens: args.maxTokens,
          system: [{ type: "text", text: args.system, cache_control: { type: "ephemeral" } }],
          tools: [args.tool],
          tool_choice: { type: "auto" },
          messages: [{ role: "user", content: args.user }],
        },
        { timeout: 60_000, maxRetries: 1 },
      );
      const u = res?.usage || {};
      log.info(
        `[build] ${args.kind} ${model} ${Date.now() - t0}ms in=${u.input_tokens ?? "?"} ` +
          `cached=${u.cache_read_input_tokens ?? 0} out=${u.output_tokens ?? "?"} stop=${res?.stop_reason}`,
      );
      if (res?.stop_reason === "max_tokens") continue;
      const call = (res?.content || []).find(
        (c: any) => c?.type === "tool_use" && c?.name === args.tool.name,
      );
      if (call?.input && typeof call.input === "object") return { input: call.input, model };
      const text = (res?.content || [])
        .filter((c: any) => c?.type === "text")
        .map((c: any) => String(c.text || ""))
        .join("\n");
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        try {
          return { input: JSON.parse(m[0]), model };
        } catch {
          /* falls through to the next model */
        }
      }
      log.warn(`[build] ${args.kind} ${model}: no ${args.tool.name} call`);
    } catch (e: any) {
      log.warn(
        `[build] ${args.kind} ${model} failed: ${String(e?.status || "")} ${String(e?.message || e).slice(0, 160)}`,
      );
    }
  }
  return null;
}

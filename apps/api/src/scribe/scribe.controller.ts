import { Controller, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUserPayload } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ScribeService } from "./scribe.service";

/**
 * SSE over POST, not GET+EventSource — the transcript is a large PHI-shaped body
 * (AGENTS.md [STREAMING], ARCHITECTURE.md "Streaming"). The frontend reads this
 * via fetch() + a ReadableStream, not the browser EventSource API.
 */
@Controller("encounters/:encounterId/scribe")
@UseGuards(JwtAuthGuard)
export class ScribeController {
  constructor(private readonly scribe: ScribeService) {}

  @Post("generate")
  async generate(
    @CurrentUser() user: CurrentUserPayload,
    @Param("encounterId") encounterId: string,
    @Res() res: Response,
  ) {
    // Runs before any header is written, so a tenant-isolation failure comes back
    // as a normal HTTP 403/404, not an in-stream SSE error event.
    await this.scribe.assertAccess(encounterId, user);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: don't buffer this response (infra/nginx.conf mirrors this)
    });

    try {
      for await (const event of this.scribe.generate(encounterId, user)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        // Flush each chunk immediately rather than letting Node's stream buffer coalesce them.
        (res as any).flush?.();
      }
    } catch {
      // Deliberately no error detail forwarded to the client/logs — could contain PHI from the transcript.
      res.write(`data: ${JSON.stringify({ type: "error", message: "Generation failed" })}\n\n`);
    } finally {
      res.end();
    }
  }
}

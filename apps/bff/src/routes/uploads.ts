import { Readable } from "node:stream";
import type { Request, Response } from "express";
import { env } from "#common/config/env";

/** Matches the API's upload limit and the gateway's client_max_body_size. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * `POST /uploads/transactions-csv?accountId=…`: a bank CSV, as multipart.
 * GraphQL isn't a good fit for file bodies, so this one plain route streams
 * the request straight through to the API (which stores, parses and later
 * deletes it) without the BFF parsing or keeping any of it. Preview, import
 * and discard are then GraphQL mutations on the returned upload id.
 */
export async function uploadTransactionsCsv(req: Request, res: Response): Promise<void> {
  const contentType = req.headers["content-type"] ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    res.status(415).json({ message: "Send the file as multipart/form-data" });
    return;
  }
  if (Number(req.headers["content-length"] ?? 0) > MAX_UPLOAD_BYTES) {
    res.status(413).json({ message: "File too large (2 MB at most)" });
    return;
  }

  const accountId = typeof req.query.accountId === "string" ? req.query.accountId : "";
  const url = `${env.API_URL}/imports${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`;
  const start = performance.now();
  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": contentType,
        "x-request-id": String(req.id ?? ""),
      },
      body: Readable.toWeb(req) as ReadableStream,
      // Required by fetch to send a streamed body.
      duplex: "half",
      signal: AbortSignal.timeout(env.API_TIMEOUT_MS),
    } as RequestInit);
    const body = await upstream.json().catch(() => ({}));
    req.log.info(
      { status: upstream.status, durationMs: Math.round(performance.now() - start) },
      "csv upload forwarded",
    );
    // API errors (400 unreadable file, 413 too large) pass through as they are.
    res.status(upstream.status).json(body);
  } catch (err) {
    req.log.error({ err }, "csv upload failed to reach the api");
    res.status(502).json({ message: "The API is unavailable" });
  }
}

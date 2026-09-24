import { GraphQLError } from "graphql";
import type { Logger } from "pino";
import { env } from "#common/config/env";

type Method = "GET" | "POST" | "PATCH" | "PUT";

/** Nest's default error body: `{ statusCode, message, error }`, plus `issues` from ZodValidationPipe. */
interface ApiErrorBody {
  message?: string | string[];
  issues?: unknown;
}

/**
 * Thin fetch wrapper for apps/api, built once per GraphQL request (see
 * graphql/context.ts) so every call:
 *  - forwards the request id → the API's access log shares it
 *  - logs method/path/status/duration under the request's own logger
 *  - turns API failures into GraphQL errors with a stable `extensions.code`
 *    the frontend can branch on, instead of leaking raw upstream responses
 */
export class ApiClient {
  constructor(
    private readonly requestId: string,
    private readonly log: Logger,
    private readonly baseUrl: string = env.API_URL,
  ) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  private async request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const start = performance.now();
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-request-id": this.requestId,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(env.API_TIMEOUT_MS),
      });
    } catch (err) {
      this.log.error(
        { method, path, durationMs: Math.round(performance.now() - start), err },
        "api call failed to connect",
      );
      throw new GraphQLError("The API is unavailable", {
        extensions: { code: "UPSTREAM_UNAVAILABLE" },
      });
    }

    const durationMs = Math.round(performance.now() - start);

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as ApiErrorBody;
      const level = response.status >= 500 ? "error" : "warn";
      this.log[level](
        { method, path, status: response.status, durationMs, message: errorBody.message },
        "api call returned an error",
      );
      throw toGraphQLError(response.status, errorBody);
    }

    this.log.debug({ method, path, status: response.status, durationMs }, "api call");
    return (await response.json()) as T;
  }
}

function toGraphQLError(status: number, body: ApiErrorBody): GraphQLError {
  const message = Array.isArray(body.message) ? body.message.join("; ") : body.message;

  if (status === 400) {
    return new GraphQLError(message ?? "Invalid input", {
      extensions: { code: "BAD_USER_INPUT", issues: body.issues },
    });
  }
  if (status === 404) {
    return new GraphQLError(message ?? "Not found", { extensions: { code: "NOT_FOUND" } });
  }
  // 5xx and anything unexpected: don't pass internal API messages to the client.
  return new GraphQLError("Upstream API error", {
    extensions: { code: "UPSTREAM_ERROR", status },
  });
}

import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodType, ZodTypeDef } from "zod";

/**
 * Validates a request body/query against a zod DTO schema — the same schemas
 * the GraphQL resolvers used to call `.parse()` on. A failure becomes a 400
 * whose `issues` the BFF turns into a BAD_USER_INPUT GraphQL error.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  /** Input is `unknown`: query-string schemas transform ("true" → true), so in ≠ out. */
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: "Validation failed",
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}

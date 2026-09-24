import type { ApiDashboardStats } from "#clients/api-types";
import type { GraphQLContext } from "#graphql/context";

export default {
  Query: {
    dashboardStats: (_: unknown, __: unknown, ctx: GraphQLContext) =>
      ctx.api.get<ApiDashboardStats>("/dashboard/stats"),
  },
};

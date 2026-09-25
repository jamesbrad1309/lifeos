import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const apolloClient = new ApolloClient({
  link: new HttpLink({ uri: "/graphql" }),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // One cache entry per filter, not per page: "Load more" (a request
          // with `after`) appends to it, and a first page replaces it.
          transactions: {
            keyArgs: ["filter"],
            merge(existing, incoming, { args }) {
              if (!existing || !args?.after) return incoming;
              return { ...incoming, items: [...existing.items, ...incoming.items] };
            },
          },
        },
      },
    },
  }),
});

import { loadFilesSync } from "@graphql-tools/load-files";
import { mergeResolvers, mergeTypeDefs } from "@graphql-tools/merge";
import { makeExecutableSchema } from "@graphql-tools/schema";

/**
 * Globs every colocated `*.schema.graphql` / `*.resolvers.js` under this
 * directory (compiled output — scripts/copy-graphql-assets.mjs copies the
 * .graphql SDL files into dist alongside the compiled resolvers). Adding a
 * new feature under graphql/<feature>/ is picked up automatically, no
 * registry to edit.
 */
const typeDefs = mergeTypeDefs(loadFilesSync(`${__dirname}/**/*.graphql`));
const resolvers = mergeResolvers(loadFilesSync(`${__dirname}/**/*.resolvers.{js,ts}`));

export const executableSchema = makeExecutableSchema({ typeDefs, resolvers });

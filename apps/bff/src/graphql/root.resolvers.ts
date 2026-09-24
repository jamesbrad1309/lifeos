import { GraphQLScalarType, Kind } from "graphql";

const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: parseLiteral,
});

function parseLiteral(ast: import("graphql").ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT:
      return Object.fromEntries(
        ast.fields.map((field) => [field.name.value, parseLiteral(field.value)]),
      );
    case Kind.LIST:
      return ast.values.map(parseLiteral);
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}

// @graphql-tools/load-files expects a default export per colocated
// *.resolvers.ts file — a named export gets treated as a schema type name.
export default {
  JSON: JSONScalar,
  Query: {
    _root: () => true,
  },
  Mutation: {
    _root: () => true,
  },
};

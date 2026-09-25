import { ApolloProvider } from "@apollo/client/react";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Before anything renders: sets the language (saved, else the browser's).
import "#i18n/i18n";
import { apolloClient } from "#lib/apollo-client";
import { redirectLegacyHash } from "#lib/legacy-hash";
import { router } from "./router";

redirectLegacyHash();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

createRoot(rootElement).render(
  <StrictMode>
    <ApolloProvider client={apolloClient}>
      <RouterProvider router={router} />
    </ApolloProvider>
  </StrictMode>,
);

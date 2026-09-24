import { useEffect, useState } from "react";
import { type ViewId, isViewId } from "#lib/navigation";

function readHash(): ViewId {
  const view = window.location.hash.replace(/^#\/?/, "");
  return isViewId(view) ? view : "dashboard";
}

/**
 * The open view, kept in the URL hash (`#/journal`) so a refresh, the back
 * button and a shared link all land on the same page. Sidebar entries are
 * plain `<a href="#/…">` links; this just listens.
 */
export function useHashView(): ViewId {
  const [view, setView] = useState(readHash);
  useEffect(() => {
    const onChange = () => setView(readHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return view;
}

/**
 * Maps notification actionUrl values onto routes that exist in App.jsx.
 * Rows already stored with the old paths are rewritten here on click.
 */
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";

const OBJECT_ID = "[a-fA-F0-9]{24}";

function matchId(path, pattern) {
  return path.match(pattern)?.[1] || null;
}

/**
 * @returns {{ type: 'path', path: string } | { type: 'chat', id: string } | { type: 'notarization', id: string } | null}
 */
export function resolveStoredNotificationPath(actionUrl, persona = "citizen") {
  if (typeof actionUrl !== "string") return null;
  const raw = actionUrl.trim();
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;

  const queryAt = raw.indexOf("?");
  const path = queryAt === -1 ? raw : raw.slice(0, queryAt);
  const role = String(persona || "citizen").toLowerCase();

  const consultationId = matchId(
    path,
    new RegExp(`^/consultations/(${OBJECT_ID})$`),
  );
  if (consultationId) {
    const base =
      role === "lawyer" ? "/lawyer/consultations" : "/citizen/consultations";
    return { type: "path", path: `${base}?consultation=${consultationId}` };
  }

  const documentId = matchId(path, new RegExp(`^/documents/(${OBJECT_ID})$`));
  if (documentId)
    return { type: "path", path: `/citizen/documents/${documentId}` };

  const caseId = matchId(path, new RegExp(`^/cases/(${OBJECT_ID})$`));
  if (caseId) {
    const base = role === "lawyer" ? "/lawyer/cases" : "/citizen/cases";
    return { type: "path", path: `${base}?case=${caseId}` };
  }

  const notaryRequestId = matchId(
    path,
    new RegExp(`^/notary/requests/(${OBJECT_ID})$`),
  );
  if (notaryRequestId)
    return {
      type: "path",
      path: `/notary/requests?request=${notaryRequestId}`,
    };

  const notarizationId = matchId(
    path,
    new RegExp(`^/notarization/(${OBJECT_ID})$`),
  );
  if (notarizationId) {
    if (role === "notary")
      return {
        type: "path",
        path: `/notary/requests?request=${notarizationId}`,
      };
    return { type: "notarization", id: notarizationId };
  }

  const chatSessionId = matchId(path, new RegExp(`^/chat/(${OBJECT_ID})$`));
  if (chatSessionId) return { type: "chat", id: chatSessionId };

  if (path === "/lawyer/dashboard")
    return { type: "path", path: "/lawyer/home" };
  if (path === "/lawyer/setup")
    return { type: "path", path: "/lawyer/profile" };
  if (path === "/notary/dashboard")
    return { type: "path", path: "/notary/home" };

  return { type: "path", path: raw };
}

export async function destinationForNotification(
  actionUrl,
  persona = "citizen",
) {
  const resolved = resolveStoredNotificationPath(actionUrl, persona);
  if (!resolved) return null;
  if (resolved.type === "path") return resolved.path;

  if (resolved.type === "chat") {
    try {
      const { data } = await api.get(`/chat/sessions/${resolved.id}`);
      const slug = data?.session?.template?.slug;
      if (slug) return `/citizen/chat/${encodeURIComponent(slug)}`;
    } catch {
      /* session may already be gone — drop the user on their documents */
    }
    return "/citizen/documents";
  }

  try {
    const { data } = await api.get(`/notarizations/${resolved.id}`);
    const documentId = data?.document?._id || data?.document;
    if (documentId) return `/citizen/documents/${documentId}`;
  } catch {
    /* request may have been removed */
  }
  return "/citizen/documents";
}

/** Scroll the row a notification pointed at into view once the list has rendered. */
export function useNotificationFocus(param, ready, revision) {
  const [params] = useSearchParams();
  const id = params.get(param);

  useEffect(() => {
    if (!id || !ready) return undefined;
    const el = document.getElementById(`${param}-${id}`);
    if (!el) return undefined;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(() => {
      el.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [id, ready, param, revision]);

  return id;
}

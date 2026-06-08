import { create } from 'zustand';

/**
 * A page may publish a more specific "chat page key" than the URL alone implies.
 * The chat widget prefers this override over pageKeyFromPath(location.pathname),
 * so multi-step flows that live on a single route (e.g. the Open an Account
 * wizard) can surface topic/question pills tightly scoped to the step and the
 * branch the client is currently looking at.
 *
 * Convention: keys extend the base route key with a slash segment, e.g.
 * 'open-account/funding', 'open-account/setup-ira'. The override must be cleared
 * (set to null) when the publishing page unmounts so the widget falls back to
 * the plain route-derived key.
 */
export interface PageContextStore {
  /** Overrides the route-derived page key for chat topic selection; null = use the route. */
  pageContext: string | null;
  setPageContext: (key: string | null) => void;
}

export const usePageContextStore = create<PageContextStore>(set => ({
  pageContext: null,
  setPageContext: (pageContext) => set({ pageContext }),
}));

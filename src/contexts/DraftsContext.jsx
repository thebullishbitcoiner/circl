import { createContext, useContext } from "react";

const DraftsContext = createContext({
  drafts: {},
  hasNip44: false,
  saveDraft: () => {},
  deleteDraft: () => {},
  getDraft: () => null,
});

// Accepts a pre-computed value so the parent can also access draft state directly.
export function DraftsProvider({ value, children }) {
  return <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>;
}

export function useDraftsContext() {
  return useContext(DraftsContext);
}

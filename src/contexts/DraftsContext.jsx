import { createContext, useContext } from "react";
import useDrafts from "../hooks/useDrafts.js";

const DraftsContext = createContext({
  drafts: {},
  hasNip44: false,
  saveDraft: () => {},
  deleteDraft: () => {},
  getDraft: () => null,
});

export function DraftsProvider({ pubkey, signAndPublish, children }) {
  const value = useDrafts({ pubkey, signAndPublish });
  return <DraftsContext.Provider value={value}>{children}</DraftsContext.Provider>;
}

export function useDraftsContext() {
  return useContext(DraftsContext);
}

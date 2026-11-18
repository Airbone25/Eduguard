import { createContext } from "react";

// Keep the context identity stable when provider UI is hot-reloaded.
export const AuthContext = createContext(null);

import type { ReactNode } from "react";

/** Settings navigation lives in the app sidebar; each child owns its page title. */
export default function SettingsLayout({ children }: { children: ReactNode }) {
    return children;
}

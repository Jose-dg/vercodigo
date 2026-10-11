"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { useAbility, useCurrentUser } from "@/components/auth/ability-context";
import type { TopUp } from "@/lib/devdiem/stored-value";

import { TopUpDialog } from "./top-up-dialog";

type TopUpContextValue = {
    canTopUp: boolean;
    /** Opens the flow; with a top-up it resumes it (pay or follow its status). */
    openTopUp: (topUp?: TopUp) => void;
};

const TopUpContext = createContext<TopUpContextValue>({ canTopUp: false, openTopUp: () => {} });

export function useTopUp() {
    return useContext(TopUpContext);
}

/** One top-up dialog for the whole portal, opened from the top bar or history. */
export function TopUpProvider({ children }: { children: ReactNode }) {
    const ability = useAbility();
    const user = useCurrentUser();
    const canTopUp = Boolean(user?.companyId) && ability.can("create", "WalletTopUp");
    const [open, setOpen] = useState(false);
    const [resume, setResume] = useState<TopUp | null>(null);

    const openTopUp = useCallback((topUp?: TopUp) => {
        setResume(topUp ?? null);
        setOpen(true);
    }, []);
    const value = useMemo(() => ({ canTopUp, openTopUp }), [canTopUp, openTopUp]);

    return (
        <TopUpContext.Provider value={value}>
            {children}
            {canTopUp ? (
                <TopUpDialog
                    open={open}
                    resume={resume}
                    onOpenChange={(next) => {
                        setOpen(next);
                        if (!next) setResume(null);
                    }}
                />
            ) : null}
        </TopUpContext.Provider>
    );
}

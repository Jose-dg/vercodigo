"use client";

import { Plus } from "lucide-react";

import { useAbility, useCurrentUser } from "@/components/auth/ability-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { useTopUp } from "./top-up-provider";
import { WalletBalanceChip, useWalletSummary } from "./wallet-balance-chip";

/**
 * Top-right bar of the portal: company balance (or debt), top-up and theme.
 * Platform users see only the theme toggle: they have no company wallet.
 */
export function AppTopBar() {
    const ability = useAbility();
    const user = useCurrentUser();
    const { canTopUp, openTopUp } = useTopUp();
    const canSeeWallet = Boolean(user?.companyId) && ability.can("read", "Wallet");
    const { data: summary } = useWalletSummary();
    // Hidden until the backend confirms top-ups can complete.
    const topUpReady = canTopUp && summary?.topUpsAvailable === true;

    return (
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-end gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {canSeeWallet ? (
                <WalletBalanceChip onTopUp={topUpReady ? () => openTopUp() : undefined} />
            ) : null}
            {topUpReady ? (
                <Button size="sm" className="h-9 rounded-full" onClick={() => openTopUp()}>
                    <Plus aria-hidden="true" className="size-4" />
                    <span className="hidden sm:inline">Recargar</span>
                    <span className="sr-only sm:hidden">Recargar saldo</span>
                </Button>
            ) : null}
            <ThemeToggle className="rounded-full" />
        </div>
    );
}

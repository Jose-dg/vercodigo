"use client";

import { Plus } from "lucide-react";

import { useAbility, useCurrentUser } from "@/components/auth/ability-context";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { useTopUp } from "./top-up-provider";
import { WalletBalanceChip, useWalletSummary } from "./wallet-balance-chip";

/**
 * Top bar of the portal: sidebar toggle on the left; company balance (or
 * debt), top-up and theme on the right.
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
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger className="-ml-1 size-9" />
            <div className="flex-1" />
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

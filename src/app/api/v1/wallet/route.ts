import { NextResponse } from "next/server";

import { withApiKey } from "@/lib/auth/api-key-guard";
import { getOrCreateWallet } from "@/services/wallet/wallet.service";
import { sandboxWalletBalance } from "@/modules/api-v1/sandbox";

export const GET = withApiKey("wallet:read", async (_req, _ctx, principal) => {
    if (principal.environment === "SANDBOX") {
        return NextResponse.json({
            object: "wallet",
            livemode: false,
            balance: await sandboxWalletBalance(principal.companyId),
        });
    }
    const wallet = await getOrCreateWallet(principal.companyId);
    return NextResponse.json({
        object: "wallet",
        livemode: true,
        balance: { amount: wallet.balance, currency: wallet.currency },
    });
});

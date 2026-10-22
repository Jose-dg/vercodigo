import { NextResponse } from "next/server";

import { withApiKey } from "@/lib/auth/api-key-guard";
import { getOrCreateWallet } from "@/services/wallet/wallet.service";

export const GET = withApiKey("wallet:read", async (_req, _ctx, principal) => {
    const wallet = await getOrCreateWallet(principal.companyId);
    return NextResponse.json({
        object: "wallet",
        balance: { amount: wallet.balance, currency: wallet.currency },
    });
});

import { headers } from "next/headers";

import { ScanView } from "@/components/redeem/scan-view";
import { negotiateLocale } from "@/lib/i18n/config";

export default async function ScanPage({ params }: { params: Promise<{ uuid: string }> }) {
    const [{ uuid }, requestHeaders] = await Promise.all([params, headers()]);
    return <ScanView uuid={uuid} locale={negotiateLocale(requestHeaders.get("accept-language"))} />;
}

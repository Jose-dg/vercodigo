import { getPendingActivations } from "@/lib/queries/invoices";
import { PendingActivationsGrouped } from "@/components/invoices/pending/PendingActivationsGrouped";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function PendingActivationsPage() {
    const activations = await getPendingActivations();

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/invoices">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Volver
                    </Button>
                </Link>
                <div>
                    <h1 className="text-3xl font-bold">Activaciones Pendientes</h1>
                    <p className="text-muted-foreground">
                        QRs activados que aún no han sido facturados
                    </p>
                </div>
            </div>

            <PendingActivationsGrouped activations={activations} />
        </div>
    );
}

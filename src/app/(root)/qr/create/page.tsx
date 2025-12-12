import { QRGeneratorForm } from "@/components/qr/QRGeneratorForm";
import {
    SidebarTrigger,
  } from "@/components/ui/sidebar"

export default function CreateQRPage() {
    return (
        <div className="space-y-6">
            <SidebarTrigger className="-ml-1" />
            <h1 className="text-3xl font-bold">Generar Códigos QR</h1>
            <QRGeneratorForm />
        </div>
    );
}

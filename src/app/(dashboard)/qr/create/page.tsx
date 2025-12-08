import { QRGeneratorForm } from "@/components/qr/QRGeneratorForm";

export default function CreateQRPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Generar Códigos QR</h1>
            <QRGeneratorForm />
        </div>
    );
}

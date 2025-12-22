"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, FileArchive } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import QRCode from "qrcode";
import { toast } from "sonner";

interface QRData {
    id: string;
    uuid: string;
    qrData: string;
}

interface QRBulkActionsProps {
    selectedQrs: QRData[];
    onClearSelection: () => void;
}

export function QRBulkActions({ selectedQrs, onClearSelection }: QRBulkActionsProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleBulkDownload = async () => {
        if (selectedQrs.length === 0) return;

        setIsGenerating(true);
        setProgress(0);
        const zip = new JSZip();
        const folder = zip.folder("qrcodes");

        try {
            for (let i = 0; i < selectedQrs.length; i++) {
                const qr = selectedQrs[i];

                // Generate high-quality PNG
                // Using scale: 10 for high resolution
                const dataUrl = await QRCode.toDataURL(qr.qrData, {
                    width: 1024,
                    margin: 2,
                    errorCorrectionLevel: 'H'
                });

                // Remove the data:image/png;base64, prefix
                const base64Data = dataUrl.split(",")[1];
                folder?.file(`${qr.uuid}.png`, base64Data, { base64: true });

                setProgress(Math.round(((i + 1) / selectedQrs.length) * 100));
            }

            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, `qrcodes-bulk-${new Date().getTime()}.zip`);

            toast.success(`Se han generado ${selectedQrs.length} códigos QR exitosamente.`);
            onClearSelection();
        } catch (error) {
            console.error("Error generating bulk QR:", error);
            toast.error("Hubo un error al generar el archivo ZIP.");
        } finally {
            setIsGenerating(false);
            setProgress(0);
        }
    };

    if (selectedQrs.length === 0) return null;

    return (
        <div className="flex items-center gap-4 bg-blue-50 border border-blue-100 p-3 rounded-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                    {selectedQrs.length} {selectedQrs.length === 1 ? "código seleccionado" : "códigos seleccionados"}
                </p>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClearSelection}
                    disabled={isGenerating}
                    className="text-blue-700 hover:text-blue-800 hover:bg-blue-100"
                >
                    Cancelar
                </Button>
                <Button
                    onClick={handleBulkDownload}
                    disabled={isGenerating}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                    {isGenerating ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generando ({progress}%)
                        </>
                    ) : (
                        <>
                            <FileArchive className="mr-2 h-4 w-4" />
                            Descargar ZIP (.png)
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}

"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface QRDownloadButtonProps {
    uuid: string;
}

export function QRDownloadButton({ uuid }: QRDownloadButtonProps) {
    const handleDownload = () => {
        const canvas = document.getElementById(`qr-${uuid}`) as HTMLCanvasElement;
        if (canvas) {
            const pngUrl = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.href = pngUrl;
            downloadLink.download = `qr-${uuid}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        }
    };

    return (
        <Button onClick={handleDownload} className="w-full">
            <Download className="mr-2 h-4 w-4" />
            Descargar PNG
        </Button>
    );
}

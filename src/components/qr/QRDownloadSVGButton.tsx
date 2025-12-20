"use client";

import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";

interface QRDownloadSVGButtonProps {
    uuid: string;
    qrData: string;
    showText?: boolean;
}

export function QRDownloadSVGButton({ uuid, qrData, showText = false }: QRDownloadSVGButtonProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    const handleDownload = () => {
        if (!svgRef.current) return;

        const svgData = new XMLSerializer().serializeToString(svgRef.current);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const svgUrl = URL.createObjectURL(svgBlob);

        const downloadLink = document.createElement("a");
        downloadLink.href = svgUrl;
        downloadLink.download = `qr-${uuid}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(svgUrl);
    };

    return (
        <>
            <div className="hidden">
                <QRCodeSVG
                    ref={svgRef}
                    value={qrData}
                    size={256}
                    level="H"
                    includeMargin={true}
                />
            </div>
            <Button
                variant={showText ? "outline" : "ghost"}
                size={showText ? "default" : "icon"}
                onClick={handleDownload}
                title="Descargar SVG"
                className={showText ? "w-full" : "h-8 w-8"}
            >
                <FileDown className={`${showText ? "mr-2" : ""} h-4 w-4 text-blue-600`} />
                {showText ? "Descargar SVG" : <span className="sr-only">Descargar SVG</span>}
            </Button>
        </>
    );
}

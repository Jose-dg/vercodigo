"use client";

import { QRCodeCanvas } from "qrcode.react";

interface QRCodeDisplayProps {
    uuid: string;
    qrData: string;
}

export function QRCodeDisplay({ uuid, qrData }: QRCodeDisplayProps) {
    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <QRCodeCanvas
                id={`qr-${uuid}`}
                value={qrData}
                size={300}
                level="H"
                includeMargin={true}
            />
        </div>
    );
}

interface QRDataInput {
    uuid: string;
    storeCode: string;
    productSku: string;
    amount: number;
}

export function generateQRData(input: QRDataInput): string {
    // Generar URL que apunta al endpoint público
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
    console.log('🔗 [QR-GEN] Base URL from env:', baseUrl);
    console.log('🔗 [QR-GEN] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
    console.log('🔗 [QR-GEN] APP_URL:', process.env.APP_URL);

    const qrUrl = `${baseUrl}/scan/${input.uuid}`;
    console.log('🔗 [QR-GEN] Generated QR URL:', qrUrl);

    return qrUrl;
}

interface QRDataInput {
    uuid: string;
    storeCode: string;
    productSku: string;
    amount: number;
}

export function generateQRData(input: QRDataInput): string {
    // Generar URL que apunta al endpoint público
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${baseUrl}/scan/${input.uuid}`;
}

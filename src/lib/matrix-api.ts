interface MatrixPinRequest {
    productName: string;
    sku: string;
    denomination: number;
    storeCode: string;
}

interface MatrixPinResponse {
    success: boolean;
    pin?: string;
    transactionId?: string;
    error?: string;
}

export async function requestPinFromMatrix(
    data: MatrixPinRequest
): Promise<MatrixPinResponse> {
    try {
        const apiUrl = process.env.MATRIX_API_URL;
        const apiKey = process.env.MATRIX_API_KEY;

        if (!apiUrl || !apiKey) {
            console.warn('Matrix API credentials not configured');
            // Mock response for development if not configured
            if (process.env.NODE_ENV === 'development') {
                return {
                    success: true,
                    pin: 'MOCK-PIN-12345',
                    transactionId: `MOCK-TX-${Date.now()}`,
                };
            }
            throw new Error('Matrix API configuration missing');
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                product_name: data.productName,
                sku: data.sku,
                denomination: data.denomination,
                store_code: data.storeCode,
            }),
        });

        if (!response.ok) {
            throw new Error(`Matrix API error: ${response.status}`);
        }

        const result = await response.json();

        return {
            success: true,
            pin: result.pin,
            transactionId: result.transaction_id,
        };

    } catch (error) {
        console.error('Error requesting PIN from matrix:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

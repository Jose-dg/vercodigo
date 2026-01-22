export interface OrderCustomer {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
}

export interface OrderBillingAddress {
    company: string; // CRITICAL: Document ID
    phone: string;
    address_1: string;
    address_2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
}

export interface OrderLineItem {
    sku: string;
    quantity: number;
    price: string;
    _is_membership: boolean;
    _days_membership: number;
}

export interface OrderPayload {
    name: string;
    store_id: string;
    order_status_url?: string;
    total_price: string;
    customer: OrderCustomer;
    billing_address: OrderBillingAddress;
    line_items: OrderLineItem[];
}

export async function createOrder(orderData: OrderPayload) {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const endpoint = `${API_BASE_URL}/marketplaces/webhook/order/create/`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 'Authorization': 'Bearer ...' // Si tu API requiere auth
            },
            body: JSON.stringify(orderData)
        });
        const data = await response.json();
        if (!response.ok) {
            // Manejo de errores (400, 500)
            console.error('Error creando orden:', data.error);
            throw new Error(data.error || 'Error desconocido al crear la orden');
        }
        // Éxito (201 o 200)
        console.log('Orden creada exitosamente:', data);
        return data;
    } catch (error) {
        console.error('Error de red o servidor:', error);
        throw error;
    }
}

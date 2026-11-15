export type PurchaseTargetStore = {
    id: string;
    name: string;
    companyId: string;
    code: string;
    address: string;
};

export function formatPurchaseTargetStore(store: Pick<PurchaseTargetStore, "name" | "code" | "address">): string {
    return [store.name, store.code, store.address]
        .map((value) => value.trim())
        .filter(Boolean)
        .join(" · ");
}

export function purchaseTargetWarning(companyName: string, originLabel: string): string {
    return `El cargo se hará a ${companyName} y la compra quedará atribuida a ${originLabel}.`;
}

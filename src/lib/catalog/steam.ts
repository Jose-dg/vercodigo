export type SteamProductSpec = {
    name: string;
    sku: string;
    amount: number;
    currency: "USD" | "COP";
    devDiemProductId: string;
    cost?: number;
};

export const RETIRED_STEAM_SKUS = ["7993660843273"] as const;

export const STEAM_CATALOG: readonly SteamProductSpec[] = [
    {
        name: "Steam Wallet US$5",
        sku: "79936608432A",
        amount: 5,
        currency: "USD",
        devDiemProductId: "0953a6e5-a4dd-414a-b4b1-75621ee5e074",
    },
    {
        name: "Steam Wallet US$10",
        sku: "93839483",
        amount: 10,
        currency: "USD",
        devDiemProductId: "5d6750dc-d1eb-4105-98c9-45b20ff410c4",
    },
    {
        name: "Steam Wallet US$20",
        sku: "3423242342-25",
        amount: 20,
        currency: "USD",
        devDiemProductId: "f1943029-d4df-4afa-9f83-9f75878bdc33",
    },
    {
        name: "Steam Wallet US$25",
        sku: "7993660843223",
        amount: 25,
        currency: "USD",
        devDiemProductId: "77727452-c107-4d7d-9754-d49ef9fb499a",
    },
    {
        name: "Steam Wallet US$50",
        sku: "799366010272",
        amount: 50,
        currency: "USD",
        devDiemProductId: "3b4ff719-3401-4953-acc7-998b2e422560",
    },
    {
        name: "Steam Wallet US$100",
        sku: "3423242342-25-D100-88E399A1",
        amount: 100,
        currency: "USD",
        devDiemProductId: "88e399a1-5aa1-4b2b-9b4f-941b829a46ef",
    },
    {
        name: "Steam Wallet COP $20.500",
        sku: "26030520500",
        amount: 20500,
        currency: "COP",
        cost: 20500,
        devDiemProductId: "3f8aefaa-3981-590d-8d4f-335f9528257d",
    },
    {
        name: "Steam Wallet COP $41.000",
        sku: "26030541000",
        amount: 41000,
        currency: "COP",
        cost: 41000,
        devDiemProductId: "978a9348-a74d-4b19-9774-114925a0c7f9",
    },
    {
        name: "Steam Wallet COP $82.000",
        sku: "26030582000",
        amount: 82000,
        currency: "COP",
        cost: 82000,
        devDiemProductId: "c17451ca-6bd2-519d-9a7d-865f21e51c9b",
    },
    {
        name: "Steam Wallet COP $123.000",
        sku: "260305123000",
        amount: 123000,
        currency: "COP",
        cost: 123000,
        devDiemProductId: "c115da26-165e-5733-af91-4d3d727b5221",
    },
    {
        name: "Steam Wallet COP $205.000",
        sku: "260305205000",
        amount: 205000,
        currency: "COP",
        cost: 205000,
        devDiemProductId: "103f178e-0730-4b15-acae-c976b0d0b8e2",
    },
];

export const STEAM_COP_CATALOG = STEAM_CATALOG.filter(
    (product) => product.currency === "COP",
);

import { PrismaClient, UserRole } from "@prisma/client";
import { createUser } from "../src/services/users/users.service";
import { activateCard } from "../src/services/self-service/activate-card.service";
import { purchaseCodes } from "../src/services/self-service/purchase-codes.service";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

async function main() {
    console.log("🚀 Starting Integration Test...");

    try {
        // --- 1. SETUP: Create Company & Store & Product ---
        console.log("Creating Test Company...");
        const company = await prisma.company.create({
            data: {
                name: "Test Corp " + nanoid(4),
                taxId: "TAX-" + nanoid(8),
                email: "test@corp.com",
                phone: "1234567890",
            }
        });

        console.log("Creating Test Store...");
        const store = await prisma.store.create({
            data: {
                name: "Test Store",
                code: "ST-" + nanoid(6),
                address: "Calle 123",
                phone: "0987654321",
                companyId: company.id,
                isActive: true,
            }
        });

        console.log("Creating Test Product...");
        const product = await prisma.product.create({
            data: {
                name: "Digital Gift Card $50",
                sku: "SKU-" + nanoid(6),
                brand: "Diem",
                isActive: true,
                isGiftCard: true,
            }
        });

        // --- 2. USER MANAGEMENT: Create Store Operator ---
        console.log("Creating Store Operator...");
        // Define an "acting user" (Super Admin) to satisfy current user checks in service
        const superAdmin = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
        if (!superAdmin) throw new Error("No Super Admin found in DB to act as creator");

        const operatorData = {
            name: "Juan Operator",
            email: `juan.${nanoid(5)}@test.com`,
            passwordHash: "hashed_password", // The service expects password for CreateUserInput, but maybe I should check the service again
            role: UserRole.OPERATOR,
            companyId: company.id,
            storeId: store.id,
            isActive: true,
        };

        // Note: The createUser service uses CreateUserInput which might have different field names than DB
        // Let's ensure we follow the service's DTO
        const operatorForm = {
            name: "Juan Operator",
            email: `juan.${nanoid(5)}@test.com`,
            password: "password123",
            role: UserRole.OPERATOR,
            companyId: company.id,
            storeId: store.id,
            isActive: true,
        };

        const operator = await createUser(operatorForm as any, superAdmin);
        console.log(`✅ Operator created: ${operator.email} (ID: ${operator.id})`);

        // --- 3. QR ACTIVATION: Activate a card ---
        console.log("Testing QR Activation...");
        const cardUuid = nanoid(10);
        const card = await prisma.card.create({
            data: {
                uuid: cardUuid,
                qrData: "https://diem.sas/scan/" + cardUuid,
                storeId: store.id,
                productId: product.id,
                isActivated: false,
            }
        });

        const activationResult = await activateCard({
            qr: cardUuid,
            userId: operator.id,
            ipAddress: "127.0.0.1",
        });

        if (activationResult.success) {
            console.log("✅ Card activated successfully.");
        }

        // Verify Billing Record (CardActivation)
        const billingRecord = await prisma.cardActivation.findFirst({
            where: { cardId: card.id }
        });
        if (billingRecord) {
            console.log("✅ Billing record (CardActivation) confirmed.");
        } else {
            throw new Error("❌ CardActivation record missing!");
        }

        // --- 4. INSTANT CODES: Purchase keys ---
        console.log("Testing Code Purchase...");
        // Add some keys for the product first
        await prisma.key.createMany({
            data: [
                { productId: product.id, code: "CODE-1-" + nanoid(5), status: "AVAILABLE" },
                { productId: product.id, code: "CODE-2-" + nanoid(5), status: "AVAILABLE" },
            ]
        });

        const purchaseResult = await purchaseCodes({
            userId: operator.id,
            productId: product.id,
            storeId: store.id,
            count: 2,
            idempotencyKey: `integration-test:${Date.now()}`,
        });

        if (purchaseResult.keys.length === 2) {
            console.log(`✅ Purchase successful. Codes: ${purchaseResult.keys.map(k => k.code).join(", ")}`);
        } else {
            throw new Error(`❌ Expected 2 codes, got ${purchaseResult.keys.length}`);
        }

        // Verify CodePurchase record
        const purchaseRecord = await prisma.codePurchase.findUnique({
            where: { id: purchaseResult.id }
        });
        if (purchaseRecord?.status === "COMPLETED") {
            console.log("✅ CodePurchase record confirmed.");
        }

        console.log("\n✨ INTEGRATION TEST PASSED SUCCESSFULLY! ✨");

    } catch (error) {
        console.error("\n❌ INTEGRATION TEST FAILED:");
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();

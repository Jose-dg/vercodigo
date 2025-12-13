// create_store_cli.ts
import prisma from './src/lib/prisma';

async function createStoreCli(name: string, address: string) {
  try {
    // These values are hardcoded for this CLI interaction.
    // In a real application, companyId and phone would come from an authenticated user context.
    const company = await prisma.company.findFirst();
    if (!company) {
      console.error("No company found in the database. Please run the seed script first.");
      process.exit(1);
    }
    const companyId = company.id;
    const phone = "1234567790";
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newStore = await prisma.store.create({
      data: {
        name,
        address,
        code,
        companyId,
        phone,
      },
    });
    console.log(`Store created successfully: ${newStore.name} (ID: ${newStore.id})`);
  } catch (error) {
    console.error("Failed to create store:", error);
    process.exit(1); // Exit with an error code
  } finally {
    await prisma.$disconnect();
  }
}

const storeName = "Puerta del norte";
const storeAddress = "Diagonal 55 #34-67, en Bello, Antioquia, Colombia";

createStoreCli(storeName, storeAddress);

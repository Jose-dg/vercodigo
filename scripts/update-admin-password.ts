import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function updateAdminPassword() {
    const email = 'admin@diemsas.com';
    const newPassword = 'm4g2025*';

    try {
        // Hash the new password
        const passwordHash = bcrypt.hashSync(newPassword, 10);

        // Update the user
        const updatedUser = await prisma.user.update({
            where: { email },
            data: { passwordHash },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            },
        });

        console.log('✅ Password updated successfully for:', updatedUser.email);
        console.log('📧 Email:', updatedUser.email);
        console.log('👤 Name:', updatedUser.name);
        console.log('🔑 Role:', updatedUser.role);
        console.log('🔒 New password: m4g2025*');
    } catch (error) {
        console.error('❌ Error updating password:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

updateAdminPassword()
    .catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });

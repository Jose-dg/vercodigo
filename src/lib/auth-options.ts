import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import prisma from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";

export const authOptions: NextAuthOptions = {
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                console.log('🔐 [AUTH] Starting authorization...');
                console.log('📧 [AUTH] Email:', credentials?.email);

                if (!credentials?.email || !credentials?.password) {
                    console.log('❌ [AUTH] Missing credentials');
                    return null;
                }

                console.log('🔍 [AUTH] Looking for user in database...');
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user) {
                    console.log('❌ [AUTH] User not found:', credentials.email);
                    return null;
                }

                console.log('✅ [AUTH] User found:', user.email, 'Role:', user.role);
                console.log('🔑 [AUTH] Verifying password...');

                const isValid = await verifyPassword(credentials.password, user.passwordHash);

                if (!isValid) {
                    console.log('❌ [AUTH] Invalid password for:', user.email);
                    return null;
                }

                console.log('✅ [AUTH] Password valid! Logging in user:', user.email);

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    companyId: user.companyId,
                    storeId: user.storeId,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.companyId = user.companyId;
                token.storeId = user.storeId;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.companyId = token.companyId as string | null;
                session.user.storeId = token.storeId as string | null;
            }
            return session;
        },
    },
};

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const companies = await prisma.company.findMany({
            include: {
                _count: {
                    select: {
                        stores: true,
                        users: true,
                        invoices: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return NextResponse.json(companies);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            name,
            taxId,
            email,
            phone,
            address,
            billingFrequency,
            commissionRate,
        } = body;

        // Validate required fields
        if (!name || !taxId || !email || !phone || !billingFrequency || commissionRate === undefined) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Check if taxId already exists
        const existingCompany = await prisma.company.findUnique({
            where: { taxId },
        });

        if (existingCompany) {
            return NextResponse.json(
                { error: 'A company with this Tax ID already exists' },
                { status: 400 }
            );
        }

        const company = await prisma.company.create({
            data: {
                name,
                taxId,
                email,
                phone,
                address,
                billingFrequency,
                commissionRate: parseFloat(commissionRate),
            },
        });

        return NextResponse.json(company, { status: 201 });
    } catch (error: any) {
        console.error('Error creating company:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create company' },
            { status: 500 }
        );
    }
}


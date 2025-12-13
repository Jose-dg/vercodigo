import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                stores: {
                    include: {
                        _count: {
                            select: {
                                cards: true,
                                activations: true,
                            },
                        },
                    },
                },
                users: true,
                invoices: {
                    take: 10,
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
                _count: {
                    select: {
                        stores: true,
                        users: true,
                        invoices: true,
                    },
                },
            },
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        return NextResponse.json(company);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();
        const {
            name,
            email,
            phone,
            address,
            isActive,
            billingFrequency,
            commissionRate,
        } = body;

        const company = await prisma.company.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(email && { email }),
                ...(phone && { phone }),
                ...(address !== undefined && { address }),
                ...(isActive !== undefined && { isActive }),
                ...(billingFrequency && { billingFrequency }),
                ...(commissionRate !== undefined && { commissionRate: parseFloat(commissionRate) }),
            },
        });

        return NextResponse.json(company);
    } catch (error: any) {
        console.error('Error updating company:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update company' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Check if company has stores
        const company = await prisma.company.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        stores: true,
                    },
                },
            },
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        if (company._count.stores > 0) {
            return NextResponse.json(
                { error: 'Cannot delete company with associated stores' },
                { status: 400 }
            );
        }

        await prisma.company.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting company:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete company' },
            { status: 500 }
        );
    }
}


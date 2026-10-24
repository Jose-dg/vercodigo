'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { docsLocation } from './nav';

export function DocsBreadcrumb() {
    const location = docsLocation(usePathname());
    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="min-w-0 flex-nowrap">
                <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink asChild>
                        <Link href="/developers">{location?.section ?? 'Desarrolladores'}</Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {location && (
                    <>
                        <BreadcrumbSeparator className="hidden md:block" />
                        <BreadcrumbItem className="min-w-0">
                            <BreadcrumbPage className="block truncate">{location.title}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </>
                )}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

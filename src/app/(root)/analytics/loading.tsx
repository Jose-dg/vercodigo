import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
    return (
        <div className="container mx-auto py-8 px-4 space-y-8">
            <div className="space-y-2">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-4 w-96" />
            </div>

            <div className="flex gap-4">
                <Skeleton className="h-12 w-[300px]" />
                <Skeleton className="h-12 w-[200px]" />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))}
            </div>

            <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="grid gap-6 md:grid-cols-2">
                    <Skeleton className="h-[400px] w-full rounded-lg" />
                    <Skeleton className="h-[400px] w-full rounded-lg" />
                </div>
            </div>
        </div>
    );
}

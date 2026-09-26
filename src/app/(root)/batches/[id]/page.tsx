import BatchDetail from "@/components/batches/BatchDetail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { isPlatformRole } from "@/lib/auth/abilities";
import { requireSessionUser } from "@/lib/auth/session";

export default async function Page({ params }: { params: { id: string } }) {
  const user = await requireSessionUser();
  if (!isPlatformRole(user.role as UserRole)) redirect("/");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Details</CardTitle>
      </CardHeader>
      <CardContent>
        <BatchDetail id={params.id} />
      </CardContent>
    </Card>
  );
}

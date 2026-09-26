import BatchForm from "@/components/batches/BatchForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { isPlatformRole } from "@/lib/auth/abilities";
import { requireSessionUser } from "@/lib/auth/session";

export default async function Page() {
  const user = await requireSessionUser();
  if (!isPlatformRole(user.role as UserRole)) redirect("/");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Batch</CardTitle>
      </CardHeader>
      <CardContent>
        <BatchForm />
      </CardContent>
    </Card>
  );
}

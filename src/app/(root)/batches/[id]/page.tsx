import BatchDetail from "@/components/batches/BatchDetail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page({ params }: { params: { id: string } }) {
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

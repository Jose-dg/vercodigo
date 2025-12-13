import BatchForm from "@/components/batches/BatchForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Page() {
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

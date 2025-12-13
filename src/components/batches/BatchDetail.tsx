"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface BatchDetailProps {
  id: string;
}

export default function BatchDetail({ id }: BatchDetailProps) {
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBatch() {
      try {
        const response = await fetch(`/api/batches/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch batch");
        }
        const data = await response.json();
        setBatch(data);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    }

    fetchBatch();
  }, [id]);

  if (loading) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!batch) {
    return <div>Batch not found</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{batch.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>ID: {batch.id}</p>
        <p>Quantity: {batch.quantity}</p>
        <p>Created At: {new Date(batch.createdAt).toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

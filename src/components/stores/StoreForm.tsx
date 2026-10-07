"use client";

import { useFormStatus } from "react-dom";
import React from "react";
import { createStore } from "@/app/actions/store";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const initialState = {
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full md:w-auto md:ml-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
    >
      {pending ? "Creando..." : "Crear Tienda"}
    </Button>
  );
}

export default function StoreForm() {
  const [state, formAction] = React.useActionState(createStore, initialState);
  const { toast } = useToast();

  React.useEffect(() => {
    if (state?.message) {
      if (state.message.includes("Error") || state.message.includes("error")) {
        toast({
          variant: "destructive",
          title: "Error",
          description: state.message,
        });
      } else {
        toast({
          title: "Tienda creada",
          description: state.message,
        });
      }
    }
  }, [state?.message, toast]);

  return (
    <Card className="bg-card shadow-sm border-border">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground">Crear Nueva Tienda</CardTitle>
        <CardDescription>Ingresa la información de la nueva tienda.</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground font-medium">
              Nombre de la Tienda
            </Label>
            <Input
              id="name"
              name="name"
              placeholder="Ej: Tienda Centro"
              required
              className="bg-muted/40 border-border focus:ring-blue-500 focus:bg-card transition-colors"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address" className="text-foreground font-medium">
              Dirección
            </Label>
            <Input
              id="address"
              name="address"
              type="text"
              placeholder="Ej: Calle 123 #45-67, Medellín"
              required
              className="bg-muted/40 border-border focus:ring-blue-500 focus:bg-card transition-colors"
            />
          </div>
        </CardContent>
        <CardFooter className="bg-muted/40/50 border-t border-gray-100 p-6">
          <SubmitButton />
        </CardFooter>
        <p aria-live="polite" className="sr-only" role="status">
          {state?.message}
        </p>
      </form>
    </Card>
  );
}

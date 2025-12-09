"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound } from "lucide-react";
import { updateQRPin } from "@/app/actions/qr";
import { useToast } from "@/hooks/use-toast";

interface QRUpdatePinButtonProps {
  id: string;
  uuid: string;
  currentPin: string | null;
}

export function QRUpdatePinButton({ id, uuid, currentPin }: QRUpdatePinButtonProps) {
  const [open, setOpen] = useState(false);
  const [pin, setPin] = useState(currentPin || "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setLoading(true);
    const result = await updateQRPin(id, pin);
    setLoading(false);

    if (result.success) {
      toast({
        title: "PIN Actualizado",
        description: `El PIN para el código ${uuid} ha sido guardado.`,
      });
      setOpen(false);
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo actualizar el PIN.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <KeyRound className="h-4 w-4 text-gray-500" />
          <span className="sr-only">Actualizar PIN</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Actualizar PIN del QR</DialogTitle>
          <DialogDescription>
            Introduce el PIN proporcionado por el proveedor para el código QR con UUID:{" "}
            <span className="font-mono text-sm bg-gray-100 p-1 rounded">{uuid}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pin" className="text-right">
              PIN
            </Label>
            <Input
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="col-span-3"
              placeholder="Introduce el PIN"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !pin}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Guardando..." : "Guardar PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

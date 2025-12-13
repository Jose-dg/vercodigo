"use client";

import { useState, useEffect } from "react";
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
import { updateQRKey } from "@/app/actions/qr";
import { useToast } from "@/hooks/use-toast";

interface QRUpdateKeyButtonProps {
  id: string;
  uuid: string;
  currentKey: string | null;
}

export function QRUpdateKeyButton({ id, uuid, currentKey }: QRUpdateKeyButtonProps) {
  const [open, setOpen] = useState(false);
  const [keyCode, setKeyCode] = useState(currentKey || "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Sync state with prop when it changes
  useEffect(() => {
    setKeyCode(currentKey || "");
  }, [currentKey]);

  const handleSubmit = async () => {
    setLoading(true);
    const result = await updateQRKey(id, keyCode);
    setLoading(false);

    if (result.success) {
      toast({
        title: "Clave Actualizada",
        description: `La clave para el código ${uuid} ha sido guardada.`,
      });
      setOpen(false);
    } else {
      toast({
        title: "Error",
        description: result.error || "No se pudo actualizar la clave.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <KeyRound className="h-4 w-4 text-gray-500" />
          <span className="sr-only">Actualizar Clave</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Actualizar Clave del QR</DialogTitle>
          <DialogDescription>
            Introduce la clave proporcionada por el proveedor para el código QR con UUID:{" "}
            <span className="font-mono text-sm bg-gray-100 p-1 rounded">{uuid}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="key" className="text-right">
              Clave
            </Label>
            <Input
              id="key"
              value={keyCode}
              onChange={(e) => setKeyCode(e.target.value)}
              className="col-span-3"
              placeholder="Introduce la clave"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !keyCode}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? "Guardando..." : "Guardar Clave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

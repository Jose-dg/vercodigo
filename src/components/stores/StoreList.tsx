"use client";

import { deleteStore } from "@/services/store.service";
import { Trash2 } from "lucide-react";

export default function StoreList({ stores }: { stores: any[] }) {
    const handleDelete = async (id: string) => {
        await deleteStore(id);
        window.location.reload();
    };

    return (
        <div className="space-y-4">
            {stores.map((store) => (
                <div key={store.id} className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <div>
                        <h4 className="font-semibold">{store.name}</h4>
                        <p className="text-sm text-gray-500">{store.address}</p>
                    </div>
                    <button onClick={() => handleDelete(store.id)} className="p-2 rounded-md hover:bg-gray-100">
                        <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                </div>
            ))}
        </div>
    );
}
import { ProductForm } from "@/components/products/ProductForm";

export default function CreateProductPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Gestión de Productos</h1>
            <ProductForm />
        </div>
    );
}

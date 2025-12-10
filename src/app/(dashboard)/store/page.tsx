import { getStores } from '@/services/store.service';
import StoreList from '@/components/stores/StoreList';
import StoreForm from '@/components/stores/StoreForm';

export default async function StorePage() {
    const stores = await getStores();

    return (
        <div className="space-y-6">
            <StoreForm />
            <StoreList stores={stores} />
        </div>
    );
}

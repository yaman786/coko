import { InventoryTable } from '../features/inventory/components/InventoryTable';
import { usePageTitle } from '../hooks/usePageTitle';

export function InventoryPage() {
    usePageTitle('Inventory');
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inventory Management</h1>
                <p className="text-gray-500">Track stock levels and profit margins across all product categories.</p>
            </div>

            <InventoryTable />
        </div>
    );
}

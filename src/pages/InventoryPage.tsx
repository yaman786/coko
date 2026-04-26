import { InventoryTable } from '../features/inventory/components/InventoryTable';
import { usePageTitle } from '../hooks/usePageTitle';

export function InventoryPage() {
    usePageTitle('Inventory');
    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">
                    Inventory <span className="text-purple-600">Hub</span>
                </h1>
                <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] mt-1">Track stock levels and profit margins across all product categories.</p>
            </div>

            <InventoryTable />
        </div>
    );
}

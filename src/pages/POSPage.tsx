import { PosTerminal } from '../features/pos/components/PosTerminal';
import { PosRegisterControl } from '../features/pos/components/PosRegisterControl';
import { usePageTitle } from '../hooks/usePageTitle';

export function POSPage() {
    usePageTitle('Point of Sale');
    return (
        <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-0.5 md:gap-1">
                    <h1 className="text-xl md:text-3xl font-bold tracking-tight text-gray-900">Point of Sale</h1>
                    <p className="text-gray-500 text-sm md:text-base hidden sm:block">
                        Process orders, manage cart, and complete checkouts.
                    </p>
                </div>
                <PosRegisterControl />
            </div>
            <PosTerminal />
        </div>
    );
}

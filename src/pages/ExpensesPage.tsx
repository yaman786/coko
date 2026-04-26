import { ExpensesTable } from '../features/expenses/components/ExpensesTable';
import { usePageTitle } from '../hooks/usePageTitle';
import { Wallet } from 'lucide-react';

export function ExpensesPage() {
    const isWholesale = typeof window !== 'undefined' && window.location.pathname.startsWith('/wholesale');
    const portalName = isWholesale ? 'GOD Wholesale' : 'Coko Retail';
    const accentColor = isWholesale ? 'text-sky-600' : 'text-purple-600';
    const bgGradient = isWholesale ? 'from-sky-500 to-blue-600' : 'from-purple-500 to-indigo-600';
    
    usePageTitle('Expenses', isWholesale ? 'Wholesale' : 'Retail');
    
    return (
        <div className="max-w-7xl mx-auto space-y-8 p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col gap-1">
                <h1 className="text-3xl font-black text-slate-800 tracking-tight font-['DM_Sans',sans-serif] flex items-center gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${bgGradient} rounded-2xl flex items-center justify-center shadow-xl shadow-purple-200/50`}>
                        <Wallet className="w-6 h-6 text-white" />
                    </div>
                    {portalName} <span className={accentColor}>Expenses</span>
                </h1>
                <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] ml-16">
                    Strictly isolated operational costs for the {isWholesale ? 'wholesale distribution' : 'retail shop'} network.
                </p>
            </div>

            <ExpensesTable />
        </div>
    );
}

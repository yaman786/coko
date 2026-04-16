import { ExpensesTable } from '../features/expenses/components/ExpensesTable';
import { usePageTitle } from '../hooks/usePageTitle';

export function ExpensesPage() {
    usePageTitle('Expenses');
    
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">Expenses Tracker</h1>
                <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] mt-1">Record and monitor all shop expenditures to track real profit.</p>
            </div>

            <ExpensesTable />
        </div>
    );
}

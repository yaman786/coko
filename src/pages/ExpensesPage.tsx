import { ExpensesTable } from '../features/expenses/components/ExpensesTable';
import { usePageTitle } from '../hooks/usePageTitle';

export function ExpensesPage() {
    usePageTitle('Expenses');
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-gray-900">Expenses Tracker</h1>
                <p className="text-gray-500">Record and monitor all shop expenditures to track real profit.</p>
            </div>

            <ExpensesTable />
        </div>
    );
}

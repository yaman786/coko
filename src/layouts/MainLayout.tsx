import { useState, useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, Menu, X, Settings, LogOut, Receipt, ChevronsLeft, ChevronsRight, TrendingUp, Truck, Warehouse, Boxes, Users } from 'lucide-react';
import { Toaster } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface MainLayoutProps {
    mode?: 'retail' | 'wholesale';
}

export function MainLayout({ mode = 'retail' }: MainLayoutProps) {
    const isRetail = mode === 'retail';
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try { return localStorage.getItem('sidebar-collapsed') === 'true'; }
        catch { return false; }
    });
    const { signOut, role } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const navigation = useMemo(() => {
        if (isRetail) {
            return [
                { name: 'POS', href: '/pos', icon: ShoppingCart },
                { name: 'Orders', href: '/pos/orders', icon: Receipt },
                { name: 'Inventory', href: '/pos/inventory', icon: Package },
                { name: 'Dashboard', href: '/pos/dashboard', icon: Home },
                { name: 'Analytics', href: '/pos/analytics', icon: TrendingUp },
                { name: 'Suppliers', href: '/pos/suppliers', icon: Truck },
                { name: 'Expenses', href: '/pos/expenses', icon: Receipt },
                { name: 'Settings', href: '/pos/settings', icon: Settings }
            ];
        } else {
            return [
                { name: 'GOD Dashboard', href: '/wholesale/dashboard', icon: Home },
                { name: 'Stock Warehouse', href: '/wholesale/inventory', icon: Boxes },
                { name: 'Client Ledger', href: '/wholesale/clients', icon: Users },
                { name: 'Supply Orders', href: '/wholesale/orders', icon: Receipt },
                { name: 'Supplier Ledger', href: '/wholesale/suppliers', icon: Truck },
                { name: 'System Settings', href: '/wholesale/settings', icon: Settings }
            ];
        }
    }, [isRetail]);

    useEffect(() => {
        try { localStorage.setItem('sidebar-collapsed', String(isCollapsed)); }
        catch { /* ignore */ }
    }, [isCollapsed]);

    const handleLogout = async () => {
        await signOut();
        // Return to the specific portal login
        navigate(isRetail ? '/pos/login' : '/wholesale/login');
    };

    // Dynamic Theme Classes
    const activeBg = isRetail ? 'bg-purple-50' : 'bg-sky-50';
    const activeText = isRetail ? 'text-purple-700' : 'text-sky-700';
    const iconColor = isRetail ? 'text-purple-600' : 'text-sky-600';
    const gradientFrom = isRetail ? 'from-purple-600' : 'from-sky-600';
    const gradientTo = isRetail ? 'to-pink-500' : 'to-sky-500';

    return (
        <div className={`flex bg-white h-screen overflow-hidden font-sans text-slate-900 selection:${isRetail ? 'bg-purple-100' : 'bg-sky-100'} relative`}>
            {/* Mobile sidebar backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar container */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 bg-slate-50 border-r border-slate-200 transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col ${isMobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'
                    } ${isCollapsed ? 'lg:w-[68px]' : 'lg:w-64'}`}
            >
                {/* Header */}
                <div className={`flex items-center h-16 border-b border-slate-200/60 bg-white flex-none ${isCollapsed ? 'lg:justify-center lg:px-0 px-6' : 'px-6'} justify-between`}>
                    <span className={`text-xl font-black tracking-tight text-slate-800 flex items-center gap-2 ${isCollapsed ? 'lg:gap-0' : ''}`}>
                        <div className={`w-8 h-8 bg-gradient-to-br ${gradientFrom} ${gradientTo} rounded-lg flex items-center justify-center shadow-sm flex-none`}>
                            {isRetail ? (
                                <span className="text-white text-lg leading-none">C</span>
                            ) : (
                                <Warehouse className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <span className={`transition-all duration-300 ${isCollapsed ? 'lg:hidden' : ''}`}>
                            {isRetail ? 'Coko POS' : 'GOD HUB'}
                        </span>
                    </span>
                    <button
                        className="lg:hidden text-slate-400 hover:text-slate-600 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className={`flex-1 py-6 space-y-1 overflow-y-auto ${isCollapsed ? 'lg:px-2 px-4' : 'px-4'}`}>
                    {navigation
                        .filter(item => {
                            if (role !== 'admin' && item.name === 'Dashboard') return false; 
                            return true;
                        })
                        .map((item) => {
                            const Icon = item.icon;
                            // Exact match for root, otherwise startsWith
                            const isActive = item.href === '/pos' || item.href === '/wholesale'
                                ? location.pathname === item.href
                                : location.pathname.startsWith(item.href);

                            return (
                                <NavLink
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    title={isCollapsed ? item.name : undefined}
                                    className={`flex items-center py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${isCollapsed ? 'lg:justify-center lg:px-0 px-3' : 'px-3'
                                        } ${isActive
                                            ? `${activeBg} ${activeText}`
                                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 flex-none transition-colors ${isCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'} ${isActive ? iconColor : 'text-slate-400 group-hover:text-slate-600'}`} />
                                    <span className={`font-semibold transition-all duration-300 ${isCollapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
                                </NavLink>
                            );
                        })}
                </nav>

                {/* Bottom section */}
                <div className={`border-t border-slate-200/60 space-y-2 relative z-20 bg-slate-50 flex-none ${isCollapsed ? 'lg:p-2 p-4' : 'p-4'}`}>
                    <button
                        onClick={handleLogout}
                        title={isCollapsed ? 'Sign Out' : undefined}
                        className={`flex items-center w-full py-2.5 text-sm font-semibold text-slate-600 rounded-xl transition-colors hover:bg-slate-200/60 hover:text-slate-900 ${isCollapsed ? 'lg:justify-center lg:px-0 px-3' : 'px-3'
                            }`}
                    >
                        <LogOut className={`w-5 h-5 flex-none text-slate-400 ${isCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'}`} />
                        <span className={`transition-all duration-300 ${isCollapsed ? 'lg:hidden' : ''}`}>Sign Out</span>
                    </button>
                    <div className={`pt-2 ${isCollapsed ? 'lg:hidden' : 'px-3'}`}>
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Logged in as: <span className="text-slate-600 capitalize">{role}</span></span>
                    </div>

                    {/* Desktop collapse toggle */}
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`hidden lg:flex items-center w-full py-2 text-xs font-semibold text-slate-400 rounded-lg transition-colors hover:bg-slate-200/60 hover:text-slate-600 ${isCollapsed ? 'justify-center px-0' : 'px-3'
                            }`}
                        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isCollapsed ? (
                            <ChevronsRight className="w-4 h-4 flex-none" />
                        ) : (
                            <>
                                <ChevronsLeft className="w-4 h-4 mr-2 flex-none" />
                                <span>Collapse</span>
                            </>
                        )}
                    </button>
                </div>
            </aside>

            {/* Main content area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50/50">
                {/* Mobile header */}
                <div className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-slate-200/60 shadow-sm">
                    <button
                        className="text-slate-500 hover:text-slate-700 transition-colors"
                        onClick={() => setIsMobileMenuOpen(true)}
                    >
                        <Menu className="w-6 h-6" />
                    </button>
                    <span className="text-lg font-black tracking-tight text-slate-800">
                        {isRetail ? 'Coko POS' : 'GOD HUB'}
                    </span>
                    <div className="w-6" />
                </div>

                {/* Page content */}
                <div className="flex-1 overflow-auto px-4 py-8">
                    <Outlet />
                </div>
            </main>

            <Toaster position="top-right" richColors theme="light" />
        </div>
    );
}

import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingCart, Package, Menu, X, Settings, LogOut, Receipt, ChevronsLeft, ChevronsRight, TrendingUp, Truck } from 'lucide-react';
import { Toaster } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const navigation = [
    { name: 'POS', href: '/', icon: ShoppingCart },
    { name: 'Orders', href: '/orders', icon: Receipt },
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Analytics', href: '/analytics/products', icon: TrendingUp },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Suppliers', href: '/suppliers', icon: Truck },
    { name: 'Expenses', href: '/expenses', icon: Receipt },
    { name: 'Settings', href: '/settings', icon: Settings }
];

export function MainLayout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try { return localStorage.getItem('sidebar-collapsed') === 'true'; }
        catch { return false; }
    });
    const { signOut, role } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        try { localStorage.setItem('sidebar-collapsed', String(isCollapsed)); }
        catch { /* ignore */ }
    }, [isCollapsed]);

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <div className="flex bg-white h-screen overflow-hidden font-sans text-slate-900 selection:bg-purple-100 relative">
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
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-500 rounded-lg flex items-center justify-center shadow-sm flex-none">
                            <span className="text-white text-lg leading-none">C</span>
                        </div>
                        <span className={`transition-all duration-300 ${isCollapsed ? 'lg:hidden' : ''}`}>Coko POS</span>
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
                            if (role !== 'admin' && item.name !== 'POS') return false;
                            return true;
                        })
                        .map((item) => {
                            const Icon = item.icon;
                            const isActive = item.href === '/'
                                ? location.pathname === '/'
                                : location.pathname.startsWith(item.href);

                            return (
                                <NavLink
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    title={isCollapsed ? item.name : undefined}
                                    className={`flex items-center py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${isCollapsed ? 'lg:justify-center lg:px-0 px-3' : 'px-3'
                                        } ${isActive
                                            ? 'bg-purple-50 text-purple-700'
                                            : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 flex-none transition-colors ${isCollapsed ? 'lg:mr-0 mr-3' : 'mr-3'} ${isActive ? 'text-purple-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
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
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Logged in as: <span className="text-slate-600">{role}</span></span>
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
                    <span className="text-lg font-black tracking-tight text-slate-800">Coko POS</span>
                    <div className="w-6" />
                </div>

                {/* Page content */}
                <div className="flex-1 overflow-auto">
                    <Outlet />
                </div>
            </main>

            <Toaster position="top-right" richColors theme="light" />
        </div>
    );
}

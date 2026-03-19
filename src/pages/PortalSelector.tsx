import { ShoppingBag, Warehouse, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PortalSelector() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-purple-100 via-white to-pink-100">
            {/* Logo Section */}
            <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-xl mb-6 ring-1 ring-slate-100">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl flex items-center justify-center">
                        <span className="text-white font-black text-xl tracking-tighter italic">C</span>
                    </div>
                </div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight sm:text-5xl">
                    Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500">Portal</span>
                </h1>
                <p className="mt-4 text-slate-500 font-medium text-lg">Select a department to continue to your workspace.</p>
            </div>

            {/* Portal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                {/* Retail Portal Card */}
                <button 
                    onClick={() => navigate('/pos')}
                    className="group relative flex flex-col items-start p-8 bg-white/70 backdrop-blur-xl rounded-[2.5rem] border border-white shadow-2xl shadow-purple-200/50 hover:shadow-purple-300/60 transition-all duration-500 hover:-translate-y-2 text-left"
                >
                    <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center mb-6 border border-pink-100 group-hover:bg-pink-500 group-hover:scale-110 transition-all duration-500">
                        <ShoppingBag className="w-7 h-7 text-pink-600 group-hover:text-white transition-colors duration-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Coko Boutique</h2>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">
                        Retail Point of Sale, inventory management, and customer relations for the boutique.
                    </p>
                    <div className="mt-auto flex items-center text-pink-600 font-bold tracking-tight">
                        Launch POS <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                    </div>
                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                        <ShoppingBag className="w-24 h-24 text-pink-500 rotate-12" />
                    </div>
                </button>

                {/* Wholesale Portal Card */}
                <button 
                    onClick={() => navigate('/wholesale')}
                    className="group relative flex flex-col items-start p-8 bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl shadow-slate-900/40 hover:shadow-slate-900/60 transition-all duration-500 hover:-translate-y-2 text-left"
                >
                    <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 border border-slate-700 group-hover:bg-purple-600 group-hover:scale-110 transition-all duration-500">
                        <Warehouse className="w-7 h-7 text-slate-300 group-hover:text-white transition-colors duration-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">GOD Warehouse</h2>
                    <p className="text-slate-400 font-medium leading-relaxed mb-8">
                        Bulk supply management, wholesale client orders, and warehouse logistics.
                    </p>
                    <div className="mt-auto flex items-center text-purple-400 font-bold tracking-tight">
                        Enter Warehouse <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                    </div>
                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                        <Warehouse className="w-24 h-24 text-purple-500 -rotate-12" />
                    </div>
                </button>
            </div>

            {/* Footer Attribution */}
            <div className="mt-16 text-slate-400 font-medium text-sm flex items-center gap-2 animate-in fade-in duration-1000 delay-500">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                System Operational & Secure
            </div>
        </div>
    );
}

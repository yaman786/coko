import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { StoreProfile } from '../features/settings/components/StoreProfile';
import { StaffSection } from '../features/settings/components/StaffSection';
import { ActivityLog } from '../features/settings/components/ActivityLog';
import { ChangePassword } from '../features/settings/components/ChangePassword';
import { usePageTitle } from '../hooks/usePageTitle';

export function SettingsPage() {
    const isWholesale = typeof window !== 'undefined' && window.location.pathname.startsWith('/wholesale');
    usePageTitle('Settings', isWholesale ? 'GOD' : 'Coko');
    return (
        <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto">
            <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">Settings</h1>
                <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] mt-1 hidden sm:block">Manage your store configuration, staff accounts, and audit trail.</p>
            </div>

            <Tabs defaultValue="store" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-white/50 backdrop-blur-xl border border-slate-200/60 p-1 rounded-xl h-12">
                    <TabsTrigger value="store" className="text-xs sm:text-sm font-bold font-['DM_Sans',sans-serif] data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm rounded-lg transition-all">Store</TabsTrigger>
                    <TabsTrigger value="staff" className="text-xs sm:text-sm font-bold font-['DM_Sans',sans-serif] data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm rounded-lg transition-all">Staff</TabsTrigger>
                    <TabsTrigger value="security" className="text-xs sm:text-sm font-bold font-['DM_Sans',sans-serif] data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm rounded-lg transition-all">Security</TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs sm:text-sm font-bold font-['DM_Sans',sans-serif] data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-sm rounded-lg transition-all">Activity</TabsTrigger>
                </TabsList>
                <TabsContent value="store" className="mt-6">
                    <StoreProfile />
                </TabsContent>
                <TabsContent value="staff" className="mt-6">
                    <StaffSection />
                </TabsContent>
                <TabsContent value="security" className="mt-6">
                    <ChangePassword />
                </TabsContent>
                <TabsContent value="activity" className="mt-6">
                    <ActivityLog />
                </TabsContent>
            </Tabs>
        </div>
    );
}

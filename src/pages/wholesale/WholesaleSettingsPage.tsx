
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { WholesaleStoreProfile } from '../../features/settings/wholesale/WholesaleStoreProfile';
import { WholesaleStaffSection } from '../../features/settings/wholesale/WholesaleStaffSection';
import { WholesaleActivityLog } from '../../features/settings/wholesale/WholesaleActivityLog';
import { ChangePassword } from '../../features/settings/components/ChangePassword';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function WholesaleSettingsPage() {

    usePageTitle('Settings', 'GOD');

    return (
        <div className="space-y-8 md:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto p-6 md:p-10">
            <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-800 font-['DM_Sans',sans-serif]">GOD System <span className="text-sky-600">Control</span></h1>
                <p className="text-slate-500 font-medium font-['DM_Sans',sans-serif] mt-1 hidden sm:block">Manage wholesale infrastructure, warehouse access, and security protocols.</p>
            </div>

            <Tabs defaultValue="store" className="w-full">
                <TabsList className="flex items-center gap-1.5 bg-white/50 backdrop-blur-md rounded-full p-1.5 border border-slate-200/60 shadow-inner h-14 w-fit max-w-full overflow-x-auto">
                    <TabsTrigger value="store" className="px-8 h-full rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-sky-500/20">Hub</TabsTrigger>
                    <TabsTrigger value="staff" className="px-8 h-full rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-sky-500/20">Team</TabsTrigger>
                    <TabsTrigger value="security" className="px-8 h-full rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-sky-500/20">Security</TabsTrigger>
                    <TabsTrigger value="activity" className="px-8 h-full rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-sky-500/20">Logs</TabsTrigger>
                </TabsList>
                
                <TabsContent value="store" className="mt-6">
                    <WholesaleStoreProfile />
                </TabsContent>
                
                <TabsContent value="staff" className="mt-6">
                    <WholesaleStaffSection />
                </TabsContent>
                
                <TabsContent value="security" className="mt-6">
                    <ChangePassword />
                </TabsContent>
                
                <TabsContent value="activity" className="mt-6">
                    <WholesaleActivityLog />
                </TabsContent>
            </Tabs>
        </div>
    );
}

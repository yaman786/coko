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
        <div className="space-y-5 md:space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
                <p className="text-slate-500 text-sm md:text-base hidden sm:block">Manage your store configuration, staff accounts, and audit trail.</p>
            </div>

            <Tabs defaultValue="store" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="store" className="text-xs sm:text-sm">Store</TabsTrigger>
                    <TabsTrigger value="staff" className="text-xs sm:text-sm">Staff</TabsTrigger>
                    <TabsTrigger value="security" className="text-xs sm:text-sm">Security</TabsTrigger>
                    <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
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

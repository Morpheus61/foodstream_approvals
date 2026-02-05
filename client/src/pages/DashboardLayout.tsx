import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Sidebar, { ViewType } from '@/components/layout/Sidebar';
import DashboardHome from '@/components/dashboard/DashboardHome';
import VoucherList from '@/components/vouchers/VoucherList';
import VoucherCreate from '@/components/vouchers/VoucherCreate';
import ApprovalQueue from '@/components/vouchers/ApprovalQueue';
import SettingsPage from '@/components/settings/SettingsPage';
import { cn } from '@/lib/utils';

export default function DashboardLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <DashboardHome />;
      case 'vouchers':
        return <VoucherList />;
      case 'create':
        return <VoucherCreate onSuccess={() => setCurrentView('vouchers')} />;
      case 'approvals':
        return <ApprovalQueue />;
      case 'settings':
        return <SettingsPage />;
      case 'companies':
        return <ComingSoon title="Companies" />;
      case 'payees':
        return <ComingSoon title="Payees" />;
      case 'users':
        return <ComingSoon title="Users" />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      
      <main
        className={cn(
          "flex-1 p-6 transition-all duration-300",
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        {renderView()}
      </main>
    </div>
  );
}

// Placeholder for pages not yet implemented
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
        <p className="text-gray-500">This feature is coming soon!</p>
      </div>
    </div>
  );
}

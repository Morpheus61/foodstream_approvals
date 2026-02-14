import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import Sidebar, { ViewType } from '@/components/layout/Sidebar';
import DashboardHome from '@/components/dashboard/DashboardHome';
import VoucherList from '@/components/vouchers/VoucherList';
import VoucherCreate from '@/components/vouchers/VoucherCreate';
import ApprovalQueue from '@/components/vouchers/ApprovalQueue';
import SettingsPage from '@/components/settings/SettingsPage';
import { cn } from '@/lib/utils';
import { Shield, AlertTriangle, XCircle } from 'lucide-react';

export default function DashboardLayout() {
  const { isAuthenticated, user, licenseInfo } = useAuthStore();
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarCollapsed(false);
        setMobileMenuOpen(false);
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu on view change
  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
    if (isMobile) setMobileMenuOpen(false);
  };

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
      {/* Mobile hamburger button */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="fixed top-3 left-3 z-50 bg-white rounded-lg p-2 shadow-md border border-gray-200"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        collapsed={isMobile ? false : sidebarCollapsed}
        onToggleCollapse={() => isMobile ? setMobileMenuOpen(false) : setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        isMobile={isMobile}
      />
      
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          isMobile ? 'ml-0 p-3 pt-14' : (sidebarCollapsed ? 'ml-16 p-6' : 'ml-64 p-6')
        )}
      >
        <LicenseBanner license={licenseInfo} />
        {renderView()}
      </main>
    </div>
  );
}

// License Validity Banner
function LicenseBanner({ license }: { license: { plan: string; status: string; expiresAt: string; activatedAt?: string } | null }) {
  if (!license) return null;

  const expiryDate = license.expiresAt ? new Date(license.expiresAt) : null;
  const now = new Date();
  const daysLeft = expiryDate ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = daysLeft !== null && daysLeft <= 0;
  const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

  const planLabel = (license.plan || 'unknown').charAt(0).toUpperCase() + (license.plan || 'unknown').slice(1);
  const formattedExpiry = expiryDate
    ? expiryDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : 'N/A';

  let bgClass = 'bg-green-50 border-green-200 text-green-800';
  let Icon = Shield;
  if (isExpired) {
    bgClass = 'bg-red-50 border-red-200 text-red-800';
    Icon = XCircle;
  } else if (isExpiringSoon) {
    bgClass = 'bg-amber-50 border-amber-200 text-amber-800';
    Icon = AlertTriangle;
  }

  return (
    <div className={cn(bgClass, 'border rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between text-sm')}>
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4" />
        <span className="font-semibold">{planLabel} Plan</span>
        <span className="opacity-50">|</span>
        <span>Status: {isExpired ? 'Expired' : license.status?.charAt(0).toUpperCase() + license.status?.slice(1)}</span>
      </div>
      <div className="flex items-center gap-3">
        {daysLeft !== null && !isExpired && (
          <>
            <span className="font-medium">{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</span>
            <span className="opacity-50">|</span>
          </>
        )}
        <span>{isExpired ? 'Expired' : 'Expires'}: {formattedExpiry}</span>
      </div>
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

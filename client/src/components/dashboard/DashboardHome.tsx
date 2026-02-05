import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { dashboardService, voucherService } from '@/services/voucherService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import {
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  FileText,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import type { Voucher } from '@/types';

export default function DashboardHome() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingVouchers: 0,
    approvedToday: 0,
    totalPendingAmount: 0,
    myPendingApprovals: 0,
  });
  const [recentVouchers, setRecentVouchers] = useState<Voucher[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load stats
      const statsResponse = await dashboardService.getStats();
      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

      // Load recent vouchers
      const vouchersResponse = await voucherService.getVouchers({ limit: 5 });
      if (vouchersResponse.success && vouchersResponse.data) {
        setRecentVouchers(vouchersResponse.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Pending Vouchers',
      value: stats.pendingVouchers,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Approved Today',
      value: stats.approvedToday,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Pending Amount',
      value: formatCurrency(stats.totalPendingAmount, 'HKD'),
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'My Pending Approvals',
      value: stats.myPendingApprovals,
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      highlight: stats.myPendingApprovals > 0,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.fullName?.split(' ')[0]}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here's what's happening with your payment approvals today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className={stat.highlight ? 'ring-2 ring-purple-200' : ''}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.title}</p>
                    <p className={`text-2xl font-bold mt-1 ${stat.color}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-6 h-6 ${stat.color}`} />
                  </div>
                </div>
                {stat.highlight && (
                  <p className="text-xs text-purple-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Action required
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Vouchers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Recent Vouchers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentVouchers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No vouchers found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentVouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-gray-500">
                        {voucher.voucherNumber}
                      </span>
                      <Badge className={getStatusColor(voucher.status)} variant="secondary">
                        {voucher.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {voucher.description?.substring(0, 50)}...
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(voucher.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {formatCurrency(voucher.amount, voucher.currency)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {voucher.payee?.name || 'Unknown Payee'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

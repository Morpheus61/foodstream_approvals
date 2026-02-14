import { useState, useEffect } from 'react';
import { voucherService } from '@/services/voucherService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { Search, Filter, Eye, FileText, Calendar, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Voucher, VoucherFilters, VoucherStatus } from '@/types';

export default function VoucherList() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const [filters, setFilters] = useState<VoucherFilters>({
    status: undefined,
    search: '',
    page: 1,
    limit: 10,
  });

  useEffect(() => {
    loadVouchers();
  }, [filters]);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      const response = await voucherService.getVouchers(filters);
      
      if (response.success && response.data) {
        setVouchers(response.data);
        if (response.pagination) {
          setPagination(response.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load vouchers:', error);
      toast.error('Failed to load vouchers');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: status === 'all' ? undefined : (status as VoucherStatus),
      page: 1,
    }));
  };

  const handleSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  // Stats calculation
  const stats = {
    total: pagination.total,
    pending: vouchers.filter((v) => v.status === 'pending').length,
    approved: vouchers.filter((v) => v.status === 'approved').length,
    rejected: vouchers.filter((v) => v.status === 'rejected').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vouchers</h1>
          <p className="text-gray-600 mt-1">View and manage all payment vouchers</p>
        </div>
        <Button onClick={loadVouchers} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search vouchers..."
                value={filters.search || ''}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filters.status || 'all'}
              onValueChange={handleStatusFilter}
            >
              <SelectTrigger className="w-full md:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Vouchers</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        {(['pending', 'approved', 'rejected'] as const).map((status) => {
          const count = stats[status];
          return (
            <Card key={status}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 capitalize">{status}</p>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                  </div>
                  <Badge className={getStatusColor(status)} variant="secondary">
                    {status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Vouchers List */}
      <Card>
        <CardHeader>
          <CardTitle>All Vouchers ({vouchers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vouchers.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Vouchers Found</h3>
              <p className="text-gray-600">
                {filters.search || filters.status
                  ? 'Try adjusting your filters'
                  : 'Create your first voucher to get started'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vouchers.map((voucher) => (
                <div
                  key={voucher.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedVoucher(voucher)}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-cyan-600">
                          {voucher.voucherNumber}
                        </span>
                        <Badge className={getStatusColor(voucher.status)} variant="secondary">
                          {voucher.status}
                        </Badge>
                      </div>
                      <p className="text-gray-700 mb-2">
                        {voucher.description?.substring(0, 80)}
                        {(voucher.description?.length || 0) > 80 && '...'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {formatDate(voucher.createdAt)}
                        </span>
                        <span>
                          {voucher.company?.name || 'N/A'}
                        </span>
                        <span>
                          To: {voucher.payee?.name || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(voucher.amount, voucher.currency)}
                        </p>
                        <p className="text-xs text-gray-500 capitalize">
                          {voucher.paymentMode?.replace('_', ' ')}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voucher Detail Dialog */}
      <Dialog open={!!selectedVoucher} onOpenChange={() => setSelectedVoucher(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {selectedVoucher?.voucherNumber}
            </DialogTitle>
            <DialogDescription>Voucher Details</DialogDescription>
          </DialogHeader>
          {selectedVoucher && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={getStatusColor(selectedVoucher.status)} variant="secondary">
                    {selectedVoucher.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="font-bold text-lg">
                    {formatCurrency(selectedVoucher.amount, selectedVoucher.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Company</p>
                  <p className="font-medium">{selectedVoucher.company?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payee</p>
                  <p className="font-medium">{selectedVoucher.payee?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Mode</p>
                  <p className="font-medium capitalize">
                    {selectedVoucher.paymentMode?.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Created</p>
                  <p className="font-medium">{formatDate(selectedVoucher.createdAt)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-500">Description</p>
                <p className="text-gray-700 mt-1">{selectedVoucher.description}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

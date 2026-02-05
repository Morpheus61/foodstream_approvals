import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { voucherService } from '@/services/voucherService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  DollarSign,
  User,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Voucher } from '@/types';

export default function ApprovalQueue() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [pendingVouchers, setPendingVouchers] = useState<Voucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject' | null>(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const loadPendingApprovals = async () => {
    try {
      setLoading(true);
      const response = await voucherService.getPendingApprovals();
      
      if (response.success && response.data) {
        setPendingVouchers(response.data);
      }
    } catch (error) {
      console.error('Failed to load pending approvals:', error);
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalAction = async () => {
    if (!selectedVoucher || !approvalAction) return;

    if (approvalAction === 'reject' && !comments.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setProcessing(true);

    try {
      let response;
      if (approvalAction === 'approve') {
        response = await voucherService.approveVoucher(selectedVoucher.id, comments);
      } else {
        response = await voucherService.rejectVoucher(selectedVoucher.id, comments);
      }

      if (response.success) {
        toast.success(`Voucher ${approvalAction}d successfully!`);
        setSelectedVoucher(null);
        setApprovalAction(null);
        setComments('');
        loadPendingApprovals();
      } else {
        toast.error(response.error || `Failed to ${approvalAction} voucher`);
      }
    } catch (error) {
      console.error(`Failed to ${approvalAction} voucher:`, error);
      toast.error(`Failed to ${approvalAction} voucher`);
    } finally {
      setProcessing(false);
    }
  };

  const totalPendingAmount = pendingVouchers.reduce((sum, v) => sum + v.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Approval Queue</h1>
          <p className="text-gray-600 mt-1">Review and approve pending payment vouchers</p>
        </div>
        <Button onClick={loadPendingApprovals} variant="outline" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approvals</p>
                <p className="text-3xl font-bold text-orange-600 mt-1">
                  {pendingVouchers.length}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <Clock className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">
                  {formatCurrency(totalPendingAmount, 'HKD')}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <DollarSign className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Your Approval Limit</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {user?.approvalLimit ? formatCurrency(user.approvalLimit, 'HKD') : '∞'}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <User className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Vouchers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Vouchers Awaiting Your Approval ({pendingVouchers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingVouchers.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Caught Up!</h3>
              <p className="text-gray-600">You have no pending approvals at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingVouchers.map((voucher) => {
                const isAboveLimit = user?.approvalLimit && voucher.amount > user.approvalLimit;

                return (
                  <div
                    key={voucher.id}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm font-medium text-cyan-600">
                            {voucher.voucherNumber}
                          </span>
                          {isAboveLimit && (
                            <Badge className="bg-red-100 text-red-700" variant="secondary">
                              Above Limit
                            </Badge>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">
                          {voucher.description?.substring(0, 100)}
                          {(voucher.description?.length || 0) > 100 && '...'}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <FileText className="w-4 h-4" />
                            {voucher.company?.name || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {voucher.payee?.name || 'N/A'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(voucher.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(voucher.amount, voucher.currency)}
                          </p>
                          <p className="text-xs text-gray-500 capitalize">
                            {voucher.paymentMode?.replace('_', ' ')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedVoucher(voucher);
                              setApprovalAction('reject');
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedVoucher(voucher);
                              setApprovalAction('approve');
                            }}
                            disabled={isAboveLimit}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Action Dialog */}
      <Dialog
        open={!!approvalAction}
        onOpenChange={() => {
          setApprovalAction(null);
          setComments('');
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {approvalAction === 'approve' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  Approve Voucher
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  Reject Voucher
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedVoucher?.voucherNumber} - {formatCurrency(selectedVoucher?.amount || 0, selectedVoucher?.currency || 'HKD')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="comments">
                {approvalAction === 'reject' ? 'Reason for Rejection *' : 'Comments (Optional)'}
              </Label>
              <Textarea
                id="comments"
                placeholder={
                  approvalAction === 'reject'
                    ? 'Please provide a reason for rejection...'
                    : 'Add any comments...'
                }
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
            </div>

            {approvalAction === 'approve' && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                This action will approve the payment voucher.
              </div>
            )}

            {approvalAction === 'reject' && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm">
                <AlertCircle className="w-4 h-4" />
                This action will reject the payment voucher.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApprovalAction(null);
                setComments('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprovalAction}
              disabled={processing || (approvalAction === 'reject' && !comments.trim())}
              variant={approvalAction === 'reject' ? 'destructive' : 'default'}
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processing...
                </>
              ) : approvalAction === 'approve' ? (
                'Approve'
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import api from '@/lib/api';
import type {
  ApiResponse,
  PaginatedResponse,
  Voucher,
  VoucherFormData,
  VoucherFilters,
  Company,
  Payee,
  HeadOfAccount,
} from '@/types';

// =====================================================
// Voucher Service - Connects to Real Backend
// =====================================================

export const voucherService = {
  // Get all vouchers with filters
  getVouchers: async (filters?: VoucherFilters): Promise<PaginatedResponse<Voucher>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.companyId) params.append('company_id', filters.companyId);
    if (filters?.fromDate) params.append('from_date', filters.fromDate);
    if (filters?.toDate) params.append('to_date', filters.toDate);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/vouchers?${params.toString()}`);
    return response.data;
  },

  // Get single voucher by ID
  getVoucher: async (id: string): Promise<ApiResponse<Voucher>> => {
    const response = await api.get(`/vouchers/${id}`);
    return response.data;
  },

  // Create new voucher
  createVoucher: async (data: VoucherFormData): Promise<ApiResponse<Voucher>> => {
    const formData = {
      company_id: data.companyId,
      payee_id: data.payeeId,
      amount: parseFloat(data.amount),
      currency: data.currency,
      payment_mode: data.paymentMode,
      head_of_account_id: data.headOfAccountId,
      description: data.description,
      due_date: data.dueDate,
    };
    const response = await api.post('/vouchers', formData);
    return response.data;
  },

  // Update voucher
  updateVoucher: async (id: string, data: Partial<VoucherFormData>): Promise<ApiResponse<Voucher>> => {
    const response = await api.put(`/vouchers/${id}`, data);
    return response.data;
  },

  // Delete voucher
  deleteVoucher: async (id: string): Promise<ApiResponse> => {
    const response = await api.delete(`/vouchers/${id}`);
    return response.data;
  },

  // Submit voucher for approval
  submitForApproval: async (id: string): Promise<ApiResponse<Voucher>> => {
    const response = await api.post(`/vouchers/${id}/submit`);
    return response.data;
  },

  // Approve voucher
  approveVoucher: async (id: string, comments?: string): Promise<ApiResponse<Voucher>> => {
    const response = await api.post(`/vouchers/${id}/approve`, { comments });
    return response.data;
  },

  // Reject voucher
  rejectVoucher: async (id: string, reason: string): Promise<ApiResponse<Voucher>> => {
    const response = await api.post(`/vouchers/${id}/reject`, { reason });
    return response.data;
  },

  // Get pending approvals for current user
  getPendingApprovals: async (): Promise<PaginatedResponse<Voucher>> => {
    const response = await api.get('/vouchers?status=pending&for_approval=true');
    return response.data;
  },

  // Sign voucher
  signVoucher: async (id: string, otp: string): Promise<ApiResponse<Voucher>> => {
    const response = await api.post(`/signatures/sign`, { voucherId: id, otp });
    return response.data;
  },

  // Verify voucher signature
  verifySignature: async (id: string): Promise<ApiResponse<{ valid: boolean; details: unknown }>> => {
    const response = await api.get(`/signatures/verify/${id}`);
    return response.data;
  },
};

// =====================================================
// Company Service
// =====================================================

export const companyService = {
  getCompanies: async (): Promise<ApiResponse<Company[]>> => {
    const response = await api.get('/companies');
    return response.data;
  },

  getCompany: async (id: string): Promise<ApiResponse<Company>> => {
    const response = await api.get(`/companies/${id}`);
    return response.data;
  },

  createCompany: async (data: Partial<Company>): Promise<ApiResponse<Company>> => {
    const response = await api.post('/companies', data);
    return response.data;
  },

  updateCompany: async (id: string, data: Partial<Company>): Promise<ApiResponse<Company>> => {
    const response = await api.put(`/companies/${id}`, data);
    return response.data;
  },
};

// =====================================================
// Payee Service
// =====================================================

export const payeeService = {
  getPayees: async (companyId?: string): Promise<ApiResponse<Payee[]>> => {
    const url = companyId ? `/payees?company_id=${companyId}` : '/payees';
    const response = await api.get(url);
    return response.data;
  },

  getPayee: async (id: string): Promise<ApiResponse<Payee>> => {
    const response = await api.get(`/payees/${id}`);
    return response.data;
  },

  createPayee: async (data: Partial<Payee>): Promise<ApiResponse<Payee>> => {
    const response = await api.post('/payees', data);
    return response.data;
  },

  updatePayee: async (id: string, data: Partial<Payee>): Promise<ApiResponse<Payee>> => {
    const response = await api.put(`/payees/${id}`, data);
    return response.data;
  },
};

// =====================================================
// Head of Account Service
// =====================================================

export const accountService = {
  getHeadsOfAccount: async (): Promise<ApiResponse<HeadOfAccount[]>> => {
    const response = await api.get('/accounts/heads');
    return response.data;
  },
};

// =====================================================
// Dashboard Service
// =====================================================

export const dashboardService = {
  getStats: async (): Promise<ApiResponse<{
    pendingVouchers: number;
    approvedToday: number;
    totalPendingAmount: number;
    myPendingApprovals: number;
  }>> => {
    const response = await api.get('/reports/dashboard-stats');
    return response.data;
  },

  getRecentActivity: async (limit: number = 10): Promise<ApiResponse<unknown[]>> => {
    const response = await api.get(`/reports/activity?limit=${limit}`);
    return response.data;
  },
};

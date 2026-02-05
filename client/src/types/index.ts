// =====================================================
// TypeScript Types for FoodStream Approvals
// =====================================================

// User & Authentication
export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  mobile?: string;
  role: UserRole;
  department?: string;
  orgId: string;
  approvalLimit?: number;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
  lastLogin?: string;
}

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'approver' | 'accounts' | 'viewer';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  orgId: string;
  role?: UserRole;
}

// License & Organization
export interface License {
  id: string;
  licenseKey: string;
  licenseType: 'trial' | 'basic' | 'premium' | 'enterprise';
  status: 'active' | 'suspended' | 'expired' | 'revoked';
  licenseeCompany: string;
  maxCompanies: number;
  maxUsers: number;
  maxVouchersPerMonth: number;
  smsCredits: number;
  expiryDate: string;
  features: LicenseFeatures;
}

export interface LicenseFeatures {
  print: boolean;
  reports: boolean;
  apiAccess: boolean;
  customDomain: boolean;
  whiteLabel: boolean;
  multiCompany: boolean;
  advancedAnalytics: boolean;
}

export interface Organization {
  id: string;
  name: string;
  legalName?: string;
  licenseKey: string;
  licenseType: string;
  status: string;
  country: string;
  currency: string;
  settings: Record<string, unknown>;
  createdAt: string;
}

// Company (Client/Subsidiary)
export interface Company {
  id: string;
  orgId: string;
  name: string;
  legalName?: string;
  gstin?: string;
  pan?: string;
  address?: Address;
  bankDetails?: BankDetails;
  logoUrl?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  branchName: string;
}

// Payee
export interface Payee {
  id: string;
  orgId: string;
  name: string;
  email?: string;
  mobile: string;
  pan?: string;
  gstin?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  address?: Address;
  status: 'active' | 'inactive';
  createdAt: string;
}

// Voucher
export interface Voucher {
  id: string;
  voucherNumber: string;
  orgId: string;
  companyId: string;
  payeeId: string;
  amount: number;
  currency: string;
  paymentMode: PaymentMode;
  headOfAccountId?: string;
  description: string;
  status: VoucherStatus;
  signature?: string;
  signedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  
  // Relations
  company?: Company;
  payee?: Payee;
  headOfAccount?: HeadOfAccount;
  createdByUser?: User;
  approvedByUser?: User;
  auditLog?: AuditLogEntry[];
  approvalChain?: ApprovalStep[];
}

export type VoucherStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';
export type PaymentMode = 'bank_transfer' | 'cheque' | 'cash' | 'upi' | 'neft' | 'rtgs';

export interface HeadOfAccount {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface ApprovalStep {
  level: number;
  approver: {
    id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: string;
  comments?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Dashboard Stats
export interface DashboardStats {
  pendingVouchers: number;
  approvedToday: number;
  rejectedToday: number;
  totalPendingAmount: number;
  myPendingApprovals: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'voucher_created' | 'voucher_approved' | 'voucher_rejected' | 'user_login';
  message: string;
  timestamp: string;
  user?: string;
}

// Form Types
export interface VoucherFormData {
  companyId: string;
  payeeId: string;
  amount: string;
  currency: string;
  paymentMode: PaymentMode;
  headOfAccountId?: string;
  description: string;
  dueDate?: string;
  attachments?: File[];
}

export interface TrialSignupData {
  companyName: string;
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  country: string;
  currency: string;
}

// Filter & Search
export interface VoucherFilters {
  status?: VoucherStatus;
  companyId?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

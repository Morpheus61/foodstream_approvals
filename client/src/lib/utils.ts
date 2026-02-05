import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'HKD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return new Date(date).toLocaleDateString('en-US', defaultOptions);
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    approved: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
    cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
    paid: 'bg-blue-100 text-blue-700 border-blue-200',
    draft: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-green-100 text-green-700 border-green-200',
    inactive: 'bg-gray-100 text-gray-700 border-gray-200',
    suspended: 'bg-orange-100 text-orange-700 border-orange-200',
    expired: 'bg-red-100 text-red-700 border-red-200',
    trial: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return colors[status] || colors.pending;
}

export function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    super_admin: 'bg-purple-100 text-purple-700',
    admin: 'bg-indigo-100 text-indigo-700',
    manager: 'bg-blue-100 text-blue-700',
    approver: 'bg-cyan-100 text-cyan-700',
    accounts: 'bg-teal-100 text-teal-700',
    viewer: 'bg-gray-100 text-gray-700',
  };
  return colors[role] || colors.viewer;
}

export function generateVoucherNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `VCH-${year}-${random}`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

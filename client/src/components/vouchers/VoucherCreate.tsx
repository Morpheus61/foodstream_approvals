import { useState, useEffect } from 'react';
import { voucherService, companyService, payeeService } from '@/services/voucherService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusCircle, DollarSign, Calendar, Building2, User, FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Company, Payee, PaymentMode, VoucherFormData } from '@/types';

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
];

const CURRENCIES = ['HKD', 'USD', 'EUR', 'GBP', 'INR', 'SGD', 'AUD', 'JPY', 'CNY'];

interface VoucherCreateProps {
  onSuccess: () => void;
}

export default function VoucherCreate({ onSuccess }: VoucherCreateProps) {
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);

  const [formData, setFormData] = useState<VoucherFormData>({
    companyId: '',
    payeeId: '',
    amount: '',
    currency: 'HKD',
    paymentMode: 'bank_transfer',
    headOfAccountId: '',
    description: '',
    dueDate: '',
  });

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      const [companiesRes, payeesRes] = await Promise.all([
        companyService.getCompanies(),
        payeeService.getPayees(),
      ]);

      if (companiesRes.success && companiesRes.data) {
        setCompanies(companiesRes.data);
      }
      if (payeesRes.success && payeesRes.data) {
        setPayees(payeesRes.data);
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    }
  };

  const handleChange = (field: keyof VoucherFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name} has an invalid file type.`);
        return false;
      }
      return true;
    });
    setAttachments((prev) => [...prev, ...validFiles]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.companyId || !formData.payeeId || !formData.amount || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }

    setLoading(true);

    try {
      const response = await voucherService.createVoucher(formData);

      if (response.success) {
        toast.success('Voucher created successfully!');
        onSuccess();
      } else {
        toast.error(response.error || 'Failed to create voucher');
      }
    } catch (error) {
      console.error('Failed to create voucher:', error);
      toast.error('Failed to create voucher. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.companyId &&
      formData.payeeId &&
      formData.amount &&
      parseFloat(formData.amount) > 0 &&
      formData.description
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Create New Voucher</h1>
        <p className="text-gray-600 mt-1">Submit a new payment request for approval</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5" />
              Voucher Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company & Payee */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="company">
                  Company <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.companyId} onValueChange={(v) => handleChange('companyId', v)}>
                  <SelectTrigger>
                    <Building2 className="w-4 h-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payee">
                  Payee/Beneficiary <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.payeeId} onValueChange={(v) => handleChange('payeeId', v)}>
                  <SelectTrigger>
                    <User className="w-4 h-4 mr-2 text-gray-400" />
                    <SelectValue placeholder="Select payee" />
                  </SelectTrigger>
                  <SelectContent>
                    {payees.map((payee) => (
                      <SelectItem key={payee.id} value={payee.id}>
                        {payee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount & Currency */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="amount">
                  Amount <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => handleChange('amount', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={formData.currency} onValueChange={(v) => handleChange('currency', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment Mode & Due Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="paymentMode">
                  Payment Mode <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.paymentMode} onValueChange={(v) => handleChange('paymentMode', v as PaymentMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => handleChange('dueDate', e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of the payment..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                required
              />
            </div>

            {/* File Attachments */}
            <div className="space-y-3">
              <Label>Attachments (Optional)</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  multiple
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">
                    <span className="text-blue-600 font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF, DOC, DOCX, JPG, PNG, GIF (max 10MB each)
                  </p>
                </label>
              </div>

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading || !isFormValid()} className="flex-1">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Create Voucher
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onSuccess}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onboardingService } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Rocket, Building2, User, Mail, Phone, Lock, Globe, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const COUNTRIES = [
  { code: 'HK', name: 'Hong Kong', currency: 'HKD' },
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'IN', name: 'India', currency: 'INR' },
  { code: 'SG', name: 'Singapore', currency: 'SGD' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'EU', name: 'Europe', currency: 'EUR' },
];

export default function TrialSignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resultData, setResultData] = useState<{ licenseKey?: string; username?: string; trialEndsAt?: string } | null>(null);
  
  const [formData, setFormData] = useState({
    companyName: '',
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    country: 'HK',
    currency: 'HKD',
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Auto-set currency when country changes
    if (field === 'country') {
      const country = COUNTRIES.find((c) => c.code === value);
      if (country) {
        setFormData((prev) => ({ ...prev, currency: country.currency }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await onboardingService.startTrial({
        companyName: formData.companyName,
        fullName: formData.fullName,
        email: formData.email,
        mobile: formData.mobile,
        password: formData.password,
        country: formData.country,
        currency: formData.currency,
      });

      if (response.success) {
        // Store license key for future API calls
        const resData = response as any;
        if (resData.licenseKey) {
          localStorage.setItem('licenseKey', resData.licenseKey);
        }
        setResultData({
          licenseKey: resData.licenseKey,
          username: resData.username,
          trialEndsAt: resData.trialEndsAt,
        });
        setSuccess(true);
        toast.success('Trial account created successfully!');
      } else {
        setError((response as any).error || 'Failed to create trial account');
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Registration failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-cyan-50 to-blue-50">
        <Card className="w-full max-w-md shadow-xl border-0 text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to FoodStream!</h2>
            <p className="text-gray-600 mb-4">
              Your 30-day free trial has been activated.
            </p>

            {resultData && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-3">
                {resultData.username && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Your Username</p>
                    <p className="font-mono font-bold text-gray-900 text-lg">{resultData.username}</p>
                  </div>
                )}
                {resultData.licenseKey && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">License Key</p>
                    <p className="font-mono text-sm text-gray-700 break-all">{resultData.licenseKey}</p>
                  </div>
                )}
                {resultData.trialEndsAt && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Trial Expires</p>
                    <p className="text-gray-700">{new Date(resultData.trialEndsAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-6">
              ⚠️ Please save your username and license key. You will need the username to sign in.
            </p>

            <Button onClick={() => navigate('/login')} className="w-full">
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50">
      <div className="w-full max-w-md">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-2xl mb-4 shadow-lg">
            <Rocket className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Start Free Trial</h1>
          <p className="text-gray-600">30 days free • No credit card required</p>
        </div>

        {/* Signup Card */}
        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle>Create Your Account</CardTitle>
            <CardDescription>
              Get started with FoodStream Approvals Flow in minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Company Name */}
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="companyName"
                    placeholder="Your Company Ltd."
                    value={formData.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Your Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="fullName"
                    placeholder="John Smith"
                    value={formData.fullName}
                    onChange={(e) => handleChange('fullName', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Mobile */}
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="mobile"
                    type="tel"
                    placeholder="+852 9123 4567"
                    value={formData.mobile}
                    onChange={(e) => handleChange('mobile', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Country & Currency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Select value={formData.country} onValueChange={(v) => handleChange('country', v)}>
                    <SelectTrigger>
                      <Globe className="w-4 h-4 mr-2 text-gray-400" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="pl-10"
                    minLength={8}
                    required
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Creating Account...
                  </>
                ) : (
                  'Start Free Trial'
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

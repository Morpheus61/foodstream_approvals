import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onboardingService } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Mail, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function LicenseActivationPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resultData, setResultData] = useState<{ username?: string; licenseKey?: string; plan?: string } | null>(null);

  const [formData, setFormData] = useState({
    licenseKey: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const formatLicenseKey = (value: string) => {
    const cleaned = value.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
    const parts = cleaned.replace(/-/g, '').match(/.{1,5}/g) || [];
    return parts.join('-').substring(0, 29);
  };

  const handleChange = (field: string, value: string) => {
    if (field === 'licenseKey') {
      value = formatLicenseKey(value);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validPrefixes = ['BSC-', 'PRM-', 'ENT-'];
    if (!validPrefixes.some((p) => formData.licenseKey.startsWith(p))) {
      setError('Invalid license key format. Must start with BSC-, PRM-, or ENT-');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await onboardingService.activateLicense(
        formData.licenseKey,
        formData.email,
        formData.password
      );

      if (response.success) {
        // Store the license key for API requests
        localStorage.setItem('licenseKey', formData.licenseKey);

        setResultData({
          username: (response as any).username,
          licenseKey: formData.licenseKey,
          plan: (response as any).license?.plan,
        });
        setSuccess(true);
        toast.success('License activated successfully!');
      } else {
        setError((response as any).error || 'License activation failed');
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Activation failed';
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">License Activated!</h2>
            <p className="text-gray-600 mb-6">
              Your license has been successfully activated. Please save your login credentials below.
            </p>

            {resultData && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-3">
                {resultData.username && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Username</p>
                    <p className="font-mono font-bold text-gray-900 text-lg">{resultData.username}</p>
                  </div>
                )}
                {resultData.licenseKey && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">License Key</p>
                    <p className="font-mono text-sm text-gray-700 break-all">{resultData.licenseKey}</p>
                  </div>
                )}
                {resultData.plan && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">Plan</p>
                    <p className="text-gray-700 capitalize">{resultData.plan}</p>
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-6">
              ⚠️ Please save your username. You will need it to sign in.
            </p>

            <Button onClick={() => navigate('/login')} className="w-full">
              Continue to Login
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
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Activate License</h1>
          <p className="text-gray-600">Enter your license key to get started</p>
        </div>

        {/* Activation Card */}
        <Card className="shadow-xl border-0">
          <CardHeader>
            <CardTitle>License Activation</CardTitle>
            <CardDescription>
              Enter your purchased license key and contact details
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

              {/* License Key */}
              <div className="space-y-2">
                <Label htmlFor="licenseKey">License Key *</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="licenseKey"
                    placeholder="BSC-XXXXX-XXXXX-XXXX-XXXX"
                    value={formData.licenseKey}
                    onChange={(e) => handleChange('licenseKey', e.target.value)}
                    className="pl-10 font-mono"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Accepted formats: BSC-, PRM-, ENT-
                </p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Primary Contact Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@company.com"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="pl-10"
                    required
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
                    required
                    minLength={8}
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
                    placeholder="Re-enter password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleChange('confirmPassword', e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Activating...
                  </>
                ) : (
                  'Activate License'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Link to="/trial">
                <Button variant="outline" className="w-full">
                  Start Free Trial Instead
                </Button>
              </Link>

              <Link to="/login" className="text-sm text-primary hover:underline block">
                Already activated? Sign in here
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Contact Sales */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Don't have a license key?</p>
          <a
            href="mailto:sales@foodstream.com.hk?subject=License%20Inquiry"
            className="text-primary hover:underline text-sm font-medium"
          >
            Contact Sales Team →
          </a>
        </div>
      </div>
    </div>
  );
}

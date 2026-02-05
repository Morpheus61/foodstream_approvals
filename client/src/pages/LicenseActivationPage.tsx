import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { onboardingService } from '@/services/authService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Mail, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LicenseActivationPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    licenseKey: '',
    email: '',
    mobile: '',
  });

  const formatLicenseKey = (value: string) => {
    // Remove non-alphanumeric, convert to uppercase
    const cleaned = value.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
    // Add dashes every 5 characters (if not already there)
    const parts = cleaned.replace(/-/g, '').match(/.{1,5}/g) || [];
    return parts.join('-').substring(0, 29); // PRM-XXXXX-XXXXX-XXXXX-XXXXX = 29 chars
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

    if (!formData.licenseKey.startsWith('PRM-') && !formData.licenseKey.startsWith('ENT-')) {
      setError('Invalid license key format. Must start with PRM- or ENT-');
      return;
    }

    setLoading(true);

    try {
      const response = await onboardingService.activateLicense(
        formData.licenseKey,
        formData.email,
        formData.mobile
      );

      if (response.success) {
        setSuccess(true);
        toast.success('License activated successfully!');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(response.error || 'License activation failed');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Activation failed';
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
              Your license has been successfully activated. You can now sign in.
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
                    placeholder="PRM-XXXXX-XXXXX-XXXXX-XXXXX"
                    value={formData.licenseKey}
                    onChange={(e) => handleChange('licenseKey', e.target.value)}
                    className="pl-10 font-mono"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Format: PRM-XXXXX-XXXXX-XXXXX-XXXXX
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

              {/* Mobile */}
              <div className="space-y-2">
                <Label htmlFor="mobile">Contact Mobile *</Label>
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

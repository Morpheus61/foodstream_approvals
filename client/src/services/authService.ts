import api from '@/lib/api';
import type {
  ApiResponse,
  LoginCredentials,
  RegisterData,
  TrialSignupData,
  User,
  License,
} from '@/types';

// =====================================================
// Authentication Service
// =====================================================

export const authService = {
  login: async (credentials: LoginCredentials): Promise<ApiResponse<{ token: string; user: User }>> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (data: RegisterData): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getMe: async (): Promise<ApiResponse<User>> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  sendOtp: async (mobile: string, otpType: string, orgId: string): Promise<ApiResponse> => {
    const response = await api.post('/auth/otp/send', { mobile, otpType, orgId });
    return response.data;
  },

  verifyOtp: async (mobile: string, otp: string): Promise<ApiResponse> => {
    const response = await api.post('/auth/otp/verify', { mobile, otp });
    return response.data;
  },
};

// =====================================================
// Onboarding Service
// =====================================================

export const onboardingService = {
  startTrial: async (data: TrialSignupData): Promise<ApiResponse<{ user: User; license: License }>> => {
    const response = await api.post('/onboarding/start-trial', data);
    return response.data;
  },

  activateLicense: async (
    licenseKey: string,
    email: string,
    mobile: string,
    companyName: string,
    fullName: string,
    password: string
  ): Promise<ApiResponse<License>> => {
    const response = await api.post('/onboarding/activate-license', {
      licenseKey,
      primaryContactEmail: email,
      primaryContactMobile: mobile,
      companyName,
      fullName,
      password,
    });
    return response.data;
  },

  verifyLicense: async (licenseKey: string): Promise<ApiResponse<License>> => {
    const response = await api.post('/onboarding/validate-license', { licenseKey });
    return response.data;
  },
};

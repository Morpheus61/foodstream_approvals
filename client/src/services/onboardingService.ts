import axios from 'axios';
import { ApiResponse, License, Organization, User } from '@/types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface TrialSignupData {
  organizationName: string;
  adminName: string;
  email: string;
  phone?: string;
  password: string;
  country?: string;
  currency?: string;
}

export interface LicenseActivationData {
  licenseKey: string;
  organizationName: string;
  adminName: string;
  email: string;
  password: string;
}

export interface OnboardingResponse {
  user: User;
  organization: Organization;
  license: License;
  token: string;
}

export const onboardingService = {
  // Start free trial
  async startTrial(data: TrialSignupData): Promise<ApiResponse<OnboardingResponse>> {
    const response = await api.post<ApiResponse<OnboardingResponse>>('/onboarding/start-trial', data);
    return response.data;
  },

  // Activate license
  async activateLicense(data: LicenseActivationData): Promise<ApiResponse<OnboardingResponse>> {
    const response = await api.post<ApiResponse<OnboardingResponse>>('/onboarding/activate-license', data);
    return response.data;
  },

  // Verify license key (check if valid before full activation)
  async verifyLicenseKey(licenseKey: string): Promise<ApiResponse<{ valid: boolean; tier?: string }>> {
    const response = await api.post<ApiResponse<{ valid: boolean; tier?: string }>>('/onboarding/validate-license', {
      licenseKey,
    });
    return response.data;
  },

  // Get pricing tiers
  async getPricingTiers(): Promise<ApiResponse<any[]>> {
    const response = await api.get<ApiResponse<any[]>>('/onboarding/pricing');
    return response.data;
  },

  // Detect geo location for currency
  async detectGeoLocation(): Promise<ApiResponse<{ country: string; currency: string; countryCode: string }>> {
    try {
      // Use free IP geolocation API
      const geoResponse = await axios.get('https://ipapi.co/json/');
      const { country_name, currency, country_code } = geoResponse.data;
      
      return {
        success: true,
        data: {
          country: country_name,
          currency: currency,
          countryCode: country_code,
        },
      };
    } catch (error) {
      // Default to USD if geo detection fails
      return {
        success: true,
        data: {
          country: 'United States',
          currency: 'USD',
          countryCode: 'US',
        },
      };
    }
  },
};

export default onboardingService;

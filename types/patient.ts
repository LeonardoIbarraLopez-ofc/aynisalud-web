export interface ContactInfo {
  email: string;
  phone: string;
  address: string;
}

export interface InsuranceInfo {
  providerName: string;
  policyNumber: string;
  coverageDetails: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string; // Date of Birth
  gender: 'male' | 'female' | 'other';
  idNumber: string;
  contactInfo: ContactInfo;
  insuranceInfo: InsuranceInfo[];
  // These would be expanded in a full implementation
  allergies: string[];
  chronicConditions: string[];
  avatarUrl?: string;
}

export interface QuickPatientInput {
    firstName: string;
    lastName: string;
    phone: string;
}
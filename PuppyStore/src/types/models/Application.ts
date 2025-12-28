import {ApplicationStatus} from '../enums';

export interface Application {
  id: string;
  status: ApplicationStatus;
  applicantId: string;
  puppyId: string;
  contactPhone: string;
  contactEmail: string;
  livingSituation: string;
  hasYard: boolean;
  hasFence: boolean;
  petExperience: string;
  otherPets?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
  puppy?: {
    id: string;
    name: string;
    status?: string;
    posterId?: string;
    photos?: {url: string}[];
  };
  applicant?: {
    id: string;
    name: string;
    email: string;
  };
  chatRoom?: {
    id: string;
  };
}

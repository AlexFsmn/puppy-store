import {PuppyStatus, VaccinationStatus} from '../enums';

export interface PuppyPhoto {
  id: string;
  url: string;
  order: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface Puppy {
  id: string;
  name: string;
  description: string;
  breed: string;
  age: number;
  gender: string;
  weight: number;
  adoptionFee: number;
  status: PuppyStatus;
  requirements: string | null;
  location: string;
  healthRecords: string | null;
  vaccinationStatus: VaccinationStatus;
  energyLevel: string;
  goodWithKids: boolean;
  goodWithPets: boolean;
  temperament: string;
  posterId: string;
  poster?: User;
  photos: PuppyPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface PuppySummary {
  id: string;
  name: string;
  description: string;
  breed: string;
  age: number;
  location: string;
  adoptionFee: number;
  photos: PuppyPhoto[];
  poster?: User;
}

export interface MyPuppy extends Puppy {
  _count?: {
    applications: number;
  };
}

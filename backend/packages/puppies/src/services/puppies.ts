import {
  prisma,
  PuppyStatus,
  VaccinationStatus,
  z,
  PaginationQuery,
  ServiceError,
  CommonErrors,
  CommonErrorCode,
  ErrorCode,
  ErrorMessage,
  createErrorHandler,
} from '@puppy-store/shared';

export type {PaginationQuery};

// Error handling
export const PuppyErrors = CommonErrors;
export type PuppyErrorCode = CommonErrorCode;

export class PuppyError extends ServiceError<PuppyErrorCode> {
  constructor(code: PuppyErrorCode, message: string) {
    super(code, message, PuppyErrors[code]);
    this.name = 'PuppyError';
  }
}

export const handlePuppyError = createErrorHandler(PuppyErrors, 'Puppy');

// Zod schemas
export const createPuppySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  breed: z.string().min(1, 'Breed is required'),
  age: z.number().int().min(0).optional().default(0),
  gender: z.string().optional().default('unknown'),
  weight: z.number().min(0).optional().default(0),
  adoptionFee: z.number().min(0).optional().default(0),
  requirements: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  healthRecords: z.string().optional(),
  vaccinationStatus: z.nativeEnum(VaccinationStatus).optional().default('UNKNOWN'),
  energyLevel: z.string().optional().default('medium'),
  goodWithKids: z.boolean().optional().default(true),
  goodWithPets: z.boolean().optional().default(true),
  temperament: z.string().optional().default(''),
  photos: z.array(z.string().url()).optional(),
});

export const updatePuppySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  breed: z.string().min(1).optional(),
  age: z.number().int().min(0).optional(),
  gender: z.string().optional(),
  weight: z.number().min(0).optional(),
  adoptionFee: z.number().min(0).optional(),
  requirements: z.string().optional(),
  location: z.string().min(1).optional(),
  status: z.nativeEnum(PuppyStatus).optional(),
  healthRecords: z.string().optional(),
  vaccinationStatus: z.nativeEnum(VaccinationStatus).optional(),
  energyLevel: z.string().optional(),
  goodWithKids: z.boolean().optional(),
  goodWithPets: z.boolean().optional(),
  temperament: z.string().optional(),
});

export type CreatePuppyData = z.infer<typeof createPuppySchema>;
export type UpdatePuppyData = z.infer<typeof updatePuppySchema>;

export async function listAvailablePuppies({limit, cursor}: PaginationQuery) {
  const puppies = await prisma.puppy.findMany({
    take: limit + 1,
    where: {status: 'AVAILABLE'},
    ...(cursor && {skip: 1, cursor: {id: cursor}}),
    select: {
      id: true,
      name: true,
      description: true,
      breed: true,
      age: true,
      location: true,
      adoptionFee: true,
      photos: {take: 1, orderBy: {order: 'asc'}},
      poster: {select: {id: true, name: true}},
    },
    orderBy: {createdAt: 'desc'},
  });

  const hasMore = puppies.length > limit;
  const data = hasMore ? puppies.slice(0, -1) : puppies;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return {data, nextCursor, hasMore};
}

export async function listUserPuppies(userId: string, {limit, cursor}: PaginationQuery) {
  const puppies = await prisma.puppy.findMany({
    take: limit + 1,
    where: {posterId: userId},
    ...(cursor && {skip: 1, cursor: {id: cursor}}),
    include: {
      photos: {take: 1, orderBy: {order: 'asc'}},
      _count: {select: {applications: true}},
    },
    orderBy: {createdAt: 'desc'},
  });

  const hasMore = puppies.length > limit;
  const data = hasMore ? puppies.slice(0, -1) : puppies;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return {data, nextCursor, hasMore};
}

export async function getPuppyById(id: string) {
  const puppy = await prisma.puppy.findUnique({
    where: {id},
    include: {
      poster: {select: {id: true, name: true}},
      photos: {orderBy: {order: 'asc'}},
    },
  });

  if (!puppy) {
    throw new PuppyError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('Puppy'));
  }

  return puppy;
}

export async function createPuppy(posterId: string, data: CreatePuppyData) {
  const {photos, ...puppyData} = data;

  return prisma.puppy.create({
    data: {
      name: puppyData.name,
      description: puppyData.description,
      breed: puppyData.breed,
      age: puppyData.age || 0,
      gender: puppyData.gender || 'unknown',
      weight: puppyData.weight || 0,
      adoptionFee: puppyData.adoptionFee || 0,
      requirements: puppyData.requirements,
      location: puppyData.location,
      healthRecords: puppyData.healthRecords,
      vaccinationStatus: puppyData.vaccinationStatus ?? 'UNKNOWN',
      energyLevel: puppyData.energyLevel || 'medium',
      goodWithKids: puppyData.goodWithKids ?? true,
      goodWithPets: puppyData.goodWithPets ?? true,
      temperament: puppyData.temperament || '',
      posterId,
      photos: photos?.length ? {
        create: photos.map((url, index) => ({url, order: index})),
      } : undefined,
    },
    include: {
      photos: true,
      poster: {select: {id: true, name: true}},
    },
  });
}

export async function updatePuppy(id: string, userId: string, data: UpdatePuppyData) {
  const puppy = await prisma.puppy.findUnique({where: {id}});

  if (!puppy) {
    throw new PuppyError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('Puppy'));
  }
  if (puppy.posterId !== userId) {
    throw new PuppyError(ErrorCode.FORBIDDEN, ErrorMessage.FORBIDDEN);
  }

  return prisma.puppy.update({
    where: {id},
    data: {
      ...(data.name && {name: data.name}),
      ...(data.description && {description: data.description}),
      ...(data.breed && {breed: data.breed}),
      ...(data.age !== undefined && {age: data.age}),
      ...(data.gender && {gender: data.gender}),
      ...(data.weight !== undefined && {weight: data.weight}),
      ...(data.adoptionFee !== undefined && {adoptionFee: data.adoptionFee}),
      ...(data.requirements !== undefined && {requirements: data.requirements}),
      ...(data.location && {location: data.location}),
      ...(data.status && {status: data.status}),
      ...(data.healthRecords !== undefined && {healthRecords: data.healthRecords}),
      ...(data.vaccinationStatus && {vaccinationStatus: data.vaccinationStatus}),
      ...(data.energyLevel && {energyLevel: data.energyLevel}),
      ...(data.goodWithKids !== undefined && {goodWithKids: data.goodWithKids}),
      ...(data.goodWithPets !== undefined && {goodWithPets: data.goodWithPets}),
      ...(data.temperament && {temperament: data.temperament}),
    },
    include: {photos: true, poster: {select: {id: true, name: true}}},
  });
}

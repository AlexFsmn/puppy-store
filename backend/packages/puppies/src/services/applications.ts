import {
  prisma,
  ApplicationStatus,
  z,
  PaginationQuery,
  ServiceError,
  CommonErrors,
  CommonErrorCode,
  ErrorCode,
  ErrorMessage,
  defineErrors,
  createErrorHandler,
} from '@puppy-store/shared';

// Zod schemas
export const createApplicationSchema = z.object({
  puppyId: z.string().min(1, 'Puppy ID is required'),
  contactPhone: z.string().min(10, 'Valid phone number is required'),
  contactEmail: z.string().email('Valid email is required'),
  livingSituation: z.string().min(1, 'Living situation is required'),
  hasYard: z.boolean().optional().default(false),
  hasFence: z.boolean().optional().default(false),
  petExperience: z.string().min(1, 'Pet experience is required'),
  otherPets: z.string().optional(),
  message: z.string().optional(),
});

export const updateApplicationStatusSchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
});

export type CreateApplicationData = z.infer<typeof createApplicationSchema>;

// Domain-specific error codes
const ApplicationErrorCode = {
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  OWN_PUPPY: 'OWN_PUPPY',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
} as const;

const DomainErrors = defineErrors({
  [ApplicationErrorCode.NOT_AVAILABLE]: 400,
  [ApplicationErrorCode.OWN_PUPPY]: 400,
  [ApplicationErrorCode.ALREADY_EXISTS]: 409,
} as const);

const ApplicationErrorMessage = {
  [ApplicationErrorCode.NOT_AVAILABLE]: 'Puppy is no longer available',
  [ApplicationErrorCode.OWN_PUPPY]: 'Cannot apply for your own puppy',
  [ApplicationErrorCode.ALREADY_EXISTS]: 'Application already submitted',
};

export const ApplicationErrors = {...CommonErrors, ...DomainErrors};
export type ApplicationErrorCodeType = CommonErrorCode | keyof typeof DomainErrors;

export class ApplicationError extends ServiceError<ApplicationErrorCodeType> {
  constructor(code: ApplicationErrorCodeType, message: string) {
    super(code, message, ApplicationErrors[code]);
    this.name = 'ApplicationError';
  }
}

export const handleApplicationError = createErrorHandler(ApplicationErrors, 'Application');

export async function createApplication(applicantId: string, data: CreateApplicationData) {
  const puppy = await prisma.puppy.findUnique({
    where: {id: data.puppyId},
    select: {id: true, status: true, posterId: true},
  });

  if (!puppy) {
    throw new ApplicationError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('Puppy'));
  }
  if (puppy.status !== 'AVAILABLE') {
    throw new ApplicationError(ApplicationErrorCode.NOT_AVAILABLE, ApplicationErrorMessage.NOT_AVAILABLE);
  }
  if (puppy.posterId === applicantId) {
    throw new ApplicationError(ApplicationErrorCode.OWN_PUPPY, ApplicationErrorMessage.OWN_PUPPY);
  }

  const existing = await prisma.application.findUnique({
    where: {applicantId_puppyId: {applicantId, puppyId: data.puppyId}},
  });
  if (existing) {
    throw new ApplicationError(ApplicationErrorCode.ALREADY_EXISTS, ApplicationErrorMessage.ALREADY_EXISTS);
  }

  return prisma.application.create({
    data: {
      applicantId,
      puppyId: data.puppyId,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      livingSituation: data.livingSituation,
      hasYard: data.hasYard ?? false,
      hasFence: data.hasFence ?? false,
      petExperience: data.petExperience,
      otherPets: data.otherPets,
      message: data.message,
    },
    include: {
      puppy: {select: {id: true, name: true}},
    },
  });
}

export async function listUserApplications(applicantId: string, {limit, cursor}: PaginationQuery) {
  const applications = await prisma.application.findMany({
    take: limit + 1,
    where: {applicantId},
    ...(cursor && {skip: 1, cursor: {id: cursor}}),
    include: {
      puppy: {
        select: {id: true, name: true, status: true, photos: {take: 1}},
      },
    },
    orderBy: {createdAt: 'desc'},
  });

  const hasMore = applications.length > limit;
  const data = hasMore ? applications.slice(0, -1) : applications;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return {data, nextCursor, hasMore};
}

export async function listReceivedApplications(posterId: string, {limit, cursor}: PaginationQuery) {
  const applications = await prisma.application.findMany({
    take: limit + 1,
    where: {puppy: {posterId}},
    ...(cursor && {skip: 1, cursor: {id: cursor}}),
    include: {
      applicant: {select: {id: true, name: true, email: true}},
      puppy: {select: {id: true, name: true}},
    },
    orderBy: {createdAt: 'desc'},
  });

  const hasMore = applications.length > limit;
  const data = hasMore ? applications.slice(0, -1) : applications;
  const nextCursor = hasMore && data.length > 0 ? data[data.length - 1].id : null;

  return {data, nextCursor, hasMore};
}

export async function getApplicationById(id: string, userId: string) {
  const application = await prisma.application.findUnique({
    where: {id},
    include: {
      applicant: {select: {id: true, name: true, email: true}},
      puppy: {select: {id: true, name: true, posterId: true}},
      chatRoom: {select: {id: true}},
    },
  });

  if (!application) {
    throw new ApplicationError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('Application'));
  }

  const isApplicant = application.applicantId === userId;
  const isPoster = application.puppy.posterId === userId;
  if (!isApplicant && !isPoster) {
    throw new ApplicationError(ErrorCode.FORBIDDEN, ErrorMessage.FORBIDDEN);
  }

  return application;
}

export async function updateApplicationStatus(id: string, userId: string, status: ApplicationStatus) {
  const application = await prisma.application.findUnique({
    where: {id},
    include: {puppy: {select: {posterId: true, id: true}}},
  });

  if (!application) {
    throw new ApplicationError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('Application'));
  }
  if (application.puppy.posterId !== userId) {
    throw new ApplicationError(ErrorCode.FORBIDDEN, ErrorMessage.FORBIDDEN);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: {id},
      data: {status},
    });

    if (status === 'ACCEPTED') {
      await tx.puppy.update({
        where: {id: application.puppy.id},
        data: {status: 'ADOPTED'},
      });

      await tx.application.updateMany({
        where: {
          puppyId: application.puppy.id,
          id: {not: id},
          status: 'PENDING',
        },
        data: {status: 'REJECTED'},
      });

      await tx.chatRoom.deleteMany({
        where: {
          application: {
            puppyId: application.puppy.id,
            id: {not: id},
          },
        },
      });
    }

    if (status === 'ACCEPTED' || status === 'REJECTED') {
      await tx.chatRoom.deleteMany({
        where: {applicationId: id},
      });
    }

    return updated;
  });
}

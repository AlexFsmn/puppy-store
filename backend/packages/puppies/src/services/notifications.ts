import {
  prisma,
  ServiceError,
  CommonErrors,
  CommonErrorCode,
  ErrorCode,
  ErrorMessage,
  createErrorHandler,
} from '@puppy-store/shared';

// Uses only common error codes (NOT_FOUND, FORBIDDEN)
export const NotificationErrors = CommonErrors;
export type NotificationErrorCode = CommonErrorCode;

export class NotificationError extends ServiceError<NotificationErrorCode> {
  constructor(code: NotificationErrorCode, message: string) {
    super(code, message, NotificationErrors[code]);
    this.name = 'NotificationError';
  }
}

export const handleNotificationError = createErrorHandler(NotificationErrors, 'Notification');

export async function getNotificationCounts(userId: string) {
  const unreadApplications = await prisma.application.count({
    where: {
      puppy: {posterId: userId},
      posterViewedAt: null,
      status: 'PENDING',
    },
  });

  const chatRooms = await prisma.chatRoom.findMany({
    where: {
      application: {
        OR: [
          {applicantId: userId},
          {puppy: {posterId: userId}},
        ],
      },
    },
    include: {
      readReceipts: {
        where: {userId},
      },
      messages: {
        orderBy: {createdAt: 'desc'},
        take: 1,
      },
      _count: {
        select: {messages: true},
      },
    },
  });

  let unreadMessages = 0;
  for (const room of chatRooms) {
    const lastRead = room.readReceipts[0]?.lastReadAt;
    if (!lastRead) {
      const unreadCount = await prisma.message.count({
        where: {
          chatRoomId: room.id,
          senderId: {not: userId},
        },
      });
      unreadMessages += unreadCount;
    } else {
      const unreadCount = await prisma.message.count({
        where: {
          chatRoomId: room.id,
          senderId: {not: userId},
          createdAt: {gt: lastRead},
        },
      });
      unreadMessages += unreadCount;
    }
  }

  return {unreadApplications, unreadMessages};
}

export async function markApplicationsAsRead(userId: string) {
  await prisma.application.updateMany({
    where: {
      puppy: {posterId: userId},
      posterViewedAt: null,
    },
    data: {
      posterViewedAt: new Date(),
    },
  });
}

export async function markChatAsRead(chatRoomId: string, userId: string) {
  const chatRoom = await prisma.chatRoom.findUnique({
    where: {id: chatRoomId},
    include: {
      application: {
        include: {puppy: {select: {posterId: true}}},
      },
    },
  });

  if (!chatRoom) {
    throw new NotificationError(ErrorCode.NOT_FOUND, ErrorMessage.NOT_FOUND('Chat room'));
  }

  const isApplicant = chatRoom.application.applicantId === userId;
  const isPoster = chatRoom.application.puppy.posterId === userId;

  if (!isApplicant && !isPoster) {
    throw new NotificationError(ErrorCode.FORBIDDEN, ErrorMessage.FORBIDDEN);
  }

  await prisma.chatReadReceipt.upsert({
    where: {
      chatRoomId_userId: {chatRoomId, userId},
    },
    update: {
      lastReadAt: new Date(),
    },
    create: {
      chatRoomId,
      userId,
      lastReadAt: new Date(),
    },
  });
}

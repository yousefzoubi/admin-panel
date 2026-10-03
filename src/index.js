import "dotenv/config";
import express from 'express';
import router from './routes.js';
import cors from 'cors';
import errorHandler from './middlewares/errorHandler.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

import prisma from './prismaClient.js';
import socketAuthMiddleware from './middlewares/socketAuth.middleware.js';
import { setIo, conversationRoom, userRoom } from './realtime.js';

const app = express();
const port = Number(process.env.PORT) || 9999;


//الترتيب مهم
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"}});

const connectedUsers = new Map();

// Share Socket.IO with the Controllers so HTTP requests emit real-time events too.
// مشاركة Socket.IO مع الـ Controllers حتى الـ HTTP كمان يرسل أحداث لحظية
setIo(io);

io.use(socketAuthMiddleware);


app.use(express.json());
app.use(cors());
app.use(router);

// This must be after all routes.
app.use(errorHandler);


// Safely send a response when the client provides a callback.
// إرسال Response بأمان إذا أرسل Client Callback
const sendSocketResponse = (callback, response) => {
  if (typeof callback === "function") {
    callback(response);
  }
};


io.on("connection", async (socket) => {

  // The user is authenticated by socketAuthMiddleware.
  // المستخدم تم التحقق منه بواسطة Socket Auth Middleware
  console.log(`Socket connected for user: ${socket.user.id}`);

  const userId = Number(socket.user.id);
  const userSockets = connectedUsers.get(userId) || new Set();
  const wasOffline = userSockets.size === 0;
  userSockets.add(socket.id);
  connectedUsers.set(userId, userSockets);

  // A private room per user, so we can reach all of their tabs later.
  // Room خاصة لكل مستخدم عشان نوصل لكل التابات المفتوحة عنده
  socket.join(userRoom(userId));

  if (wasOffline) io.emit("user_presence", { userId, online: true });
  socket.emit("presence_snapshot", { userIds: Array.from(connectedUsers.keys()) });


  socket.on("join_conversation", async (conversationId, callback) => {
    try {
      // Validate the conversation ID.
      // فحص رقم المحادثة
      if (
          !Number.isInteger(conversationId) ||
          conversationId <= 0
      ) {
        return sendSocketResponse(callback, {
          success: false,
          message: "Invalid conversation ID"
        });
      }

      // Check whether the user belongs to the conversation.
      // التأكد أن المستخدم عضو في المحادثة
      const membership = await prisma.conversationMember.findUnique({
        where: {
          userId_conversationId: {
            userId: socket.user.id,
            conversationId: conversationId
          }
        }
      });

      // Reject users who are not conversation members.
      // رفض المستخدم غير العضو في المحادثة
      if (!membership) {
        return sendSocketResponse(callback, {
          success: false,
          message: "You are not a member of this conversation"
        });
      }

      // Add the authenticated user to the conversation room.
      // إدخال المستخدم إلى Room المحادثة
      socket.join(conversationRoom(conversationId));

      return sendSocketResponse(callback, {
        success: true,
        message: "Joined conversation successfully"
      });

    } catch (err) {
      // Log unexpected Socket errors.
      // تسجيل أخطاء Socket غير المتوقعة
      console.error("Failed to join conversation", err);

      return sendSocketResponse(callback, {
        success: false,
        message: "Failed to join conversation"
      });
    }
  });


  socket.on("send_message", async (messageData, callback) => {
    try {
      // Read message data sent by the client.
      // قراءة بيانات الرسالة القادمة من Client
      const {
        conversationId,
        content
      } = messageData || {};

      // Validate the message data.
      // فحص بيانات الرسالة
      if (
          !Number.isInteger(conversationId) ||
          conversationId <= 0 ||
          typeof content !== "string" ||
          content.trim() === "" ||
          content.trim().length > 2000
      ) {
        return sendSocketResponse(callback, {
          success: false,
          message: "Invalid message data"
        });
      }

      // Check whether the sender belongs to the conversation.
      // التأكد أن المرسل عضو في المحادثة
      const membership = await prisma.conversationMember.findUnique({
        where: {
          userId_conversationId: {
            userId: socket.user.id,
            conversationId: conversationId
          }
        }
      });

      if (!membership) {
        return sendSocketResponse(callback, {
          success: false,
          message: "You are not a member of this conversation"
        });
      }

      // Save the message using the authenticated user's ID.
      // حفظ الرسالة باستخدام ID المستخدم الموثق
      const message = await prisma.message.create({
        data: {
          content: content.trim(),
          senderId: socket.user.id,
          conversationId: conversationId
        },
        select: {
          id: true,
          content: true,
          senderId: true,
          conversationId: true,
          createdAt: true,
          isRead: true,
          readAt: true,
          sender: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Send the new message to all members of the conversation room.
      // إرسال الرسالة الجديدة لكل أعضاء Room المحادثة
      io.to(conversationRoom(conversationId)).emit(
          "new_message",
          message
      );

      // Send success response to the sender.
      // إرجاع نتيجة نجاح للمرسل
      return sendSocketResponse(callback, {
        success: true,
        data: message
      });

    } catch (err) {
      // Log unexpected Socket errors.
      // تسجيل أخطاء Socket غير المتوقعة
      console.error("Failed to send message", err);

      return sendSocketResponse(callback, {
        success: false,
        message: "Failed to send message"
      });
    }
  });


  socket.on("mark_messages_read", async (conversationId, callback) => {
    try {
      // Validate the conversation ID.
      // فحص رقم المحادثة
      if (
          !Number.isInteger(conversationId) ||
          conversationId <= 0
      ) {
        return sendSocketResponse(callback, {
          success: false,
          message: "Invalid conversation ID"
        });
      }

      // Check whether the current user belongs to this conversation.
      // التأكد أن المستخدم الحالي عضو في المحادثة
      const membership = await prisma.conversationMember.findUnique({
        where: {
          userId_conversationId: {
            userId: socket.user.id,
            conversationId: conversationId
          }
        }
      });

      if (!membership) {
        return sendSocketResponse(callback, {
          success: false,
          message: "You are not a member of this conversation"
        });
      }

      // Use one timestamp for all messages marked as read.
      // استخدام نفس وقت القراءة لكل الرسائل
      const readAt = new Date();

      // Mark only unread messages sent by other users as read.
      // تعليم الرسائل غير المقروءة من المستخدمين الآخرين كمقروءة
      const result = await prisma.message.updateMany({
        where: {
          conversationId: conversationId,
          senderId: {
            not: socket.user.id
          },
          isRead: false
        },
        data: {
          isRead: true,
          readAt: readAt
        }
      });

      // Notify conversation members that messages were read.
      // إبلاغ أعضاء المحادثة أن الرسائل أصبحت مقروءة
      io.to(conversationRoom(conversationId)).emit(
          "messages_read",
          {
            conversationId: conversationId,
            userId: socket.user.id,
            readAt: readAt,
            count: result.count
          }
      );

      return sendSocketResponse(callback, {
        success: true,
        count: result.count
      });

    } catch (err) {
      // Log unexpected Socket errors.
      // تسجيل أخطاء Socket غير المتوقعة
      console.error("Failed to mark messages as read", err);

      return sendSocketResponse(callback, {
        success: false,
        message: "Failed to mark messages as read"
      });
    }
  });


  try {
    // Get all conversations that belong to the authenticated user.
    // جلب كل المحادثات التي ينتمي إليها المستخدم الحالي
    const memberships = await prisma.conversationMember.findMany({
      where: {
        userId: socket.user.id
      },
      select: {
        conversationId: true
      }
    });

    // Join a separate room for every conversation.
    // إدخال المستخدم إلى Room خاصة بكل محادثة
    memberships.forEach((membership) => {
      socket.join(conversationRoom(membership.conversationId));
    });

  } catch (err) {
    // Log connection setup errors on the server.
    // تسجيل أخطاء تجهيز الاتصال على السيرفر
    console.error("Failed to join conversation rooms", err);
  }


  // The client disconnected from the Socket server.
  // انقطع اتصال المستخدم بالسيرفر
  socket.on("disconnect", () => {
    console.log(`Socket disconnected for user: ${socket.user.id}`);
    const sockets = connectedUsers.get(userId);
    if (!sockets) return;
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      connectedUsers.delete(userId);
      io.emit("user_presence", { userId, online: false });
    }
  });

});


httpServer.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

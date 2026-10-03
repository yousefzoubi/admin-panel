// Shared access to the Socket.IO server so HTTP Controllers can also send real-time events.
// مشاركة Socket.IO مع الـ Controllers حتى يرسل الـ HTTP أحداث لحظية أيضًا

let io = null;

// Store the Socket.IO instance once the server is created.
// تخزين Socket.IO بعد إنشاء السيرفر
const setIo = (instance) => {
    io = instance;
};

const getIo = () => io;

// Room names used by both Socket handlers and HTTP Controllers.
// أسماء الـ Rooms المستخدمة في Socket و HTTP
const conversationRoom = (conversationId) => `conversation:${conversationId}`;
const userRoom = (userId) => `user:${userId}`;

// Send an event to every member of a conversation.
// إرسال حدث لكل أعضاء المحادثة
const emitToConversation = (conversationId, event, payload) => {
    if (!io) return;

    io.to(conversationRoom(conversationId)).emit(event, payload);
};

// Put every open socket of these users inside the conversation room.
// إدخال كل Sockets هؤلاء المستخدمين إلى Room المحادثة
// لازمة للمحادثات المنشأة بعد ما يكون المستخدم متصل، لأنه ما بيكون عضو في الـ Room بعد
const joinUsersToConversation = async (userIds, conversationId) => {
    if (!io) return;

    try {
        await Promise.all(
            userIds.map((userId) => {
                return io.in(userRoom(userId)).socketsJoin(conversationRoom(conversationId));
            })
        );
    } catch (err) {
        // A Socket problem must not break the HTTP request.
        // مشكلة Socket ما يجوز تفشل الـ Request
        console.error("Failed to join users to conversation room", err);
    }
};

export {
    setIo,
    getIo,
    conversationRoom,
    userRoom,
    emitToConversation,
    joinUsersToConversation
};

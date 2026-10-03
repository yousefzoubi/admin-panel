import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

const socketAuthMiddleware = async (socket, next) => {
    try {
        // Read the access token sent during the Socket.IO connection.
        // قراءة Access Token المرسلة عند فتح اتصال Socket
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Authentication required"));
        }

        // Verify the token and read the user ID stored inside it.
        // التحقق من التوكن وقراءة User ID الموجود بداخلها
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get fresh user data from the database.
        // جلب بيانات المستخدم الحالية من Database
        const user = await prisma.user.findUnique({
            where: {
                id: decoded.id
            },
            select: {
                id: true,
                role: true,
                isDeleted: true
            }
        });


        // Reject missing or soft-deleted users.
        // رفض المستخدم غير الموجود أو المحذوف Soft Delete
        if (!user || user.isDeleted) {
            return next(new Error("User is not active"));
        }

        // Store the authenticated user on the Socket object.
        // تخزين المستخدم الموثق داخل Socket
        socket.user = {
            id: user.id,
            role: user.role
        };

        // Allow the Socket connection to continue.
        // السماح باستمرار الاتصال
        next();

    } catch (err) {
        // Reject invalid or expired tokens.
        // رفض التوكن غير الصحيحة أو المنتهية
        return next(new Error("Invalid or expired token"));
    }
};
export default socketAuthMiddleware;
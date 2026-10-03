import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

//Authentcation middleware
//checking if the tkoen is valid  هل المستخدم مسجل دخول ومعه توكن صحيح؟

const authMiddleware = async (req, res, next) => {
    try {
        const authorizationHeader = req.headers.authorization;

        if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Unauthorized",
                data: null
            });
        }

        const token = authorizationHeader.split(" ")[1];

        // decoded contains the data stored inside the JWT.
        // The id comes from user.id, which was added when the token was created during login.
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

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

        // Do not allow missing or soft-deleted users to access the system.
        if (!user || user.isDeleted) {
            return res.status(401).json({
                message: "User is not active",
                data: null
            });
        }

        // Store fresh user data for the next middleware and controllers.
        // We use the database role instead of the token role
        // because the role may have changed after the token was created.
        req.user = {
            id: user.id,
            role: user.role
        };

        next();

    } catch (err) {
        // Invalid or expired JWT tokens are authentication errors.
        if (
            err.name === "JsonWebTokenError" ||
            err.name === "TokenExpiredError"
        ) {
            return res.status(401).json({
                message: "Unauthorized, invalid token",
                data: null
            });
        }

        // Pass unexpected database or server errors
        // to the centralized error handler.
        return next(err);
    }
};

//Authorization middleware
//check user role >>> if authorized user (Admin)

const requireAdmin = (req, res, next) => {
    const role = req.user.role;

    if (role !== "ADMIN") {
        return res.status(403).json({
            message: "Forbidden"
        });
    }

    next();
};

// Role permissions:
// ADMIN     -> Can manage users, restore users, manage all articles, and read audit logs.
// MODERATOR -> Can read, update, and delete any article.
// EDITOR    -> Can read, create, update, and delete articles they own.
// USER      -> Can read, create, update, and delete articles they own.
//
// Important:
// requirePermission checks whether the role has the requested action.
// requireArticleOwner checks whether the article belongs to the current user.
// ADMIN and MODERATOR can manage any article.
// USER and EDITOR can manage their own articles only.


const rolePermissions = {
    ADMIN: [
        "users.read",
        "users.update",
        "users.delete",
        "users.restore",
        "articles.read",
        "articles.create",
        "articles.update",
        "articles.delete",
        "audit.read",
        "articles.publish"
    ],

    EDITOR: [
        "articles.read",
        "articles.create",
        "articles.update",
        "articles.delete",
        "articles.publish"
    ],

    USER: [
        "articles.read",
        "articles.create",
        "articles.update",
        "articles.delete"
    ],
    MODERATOR: [
        "articles.read",
        "articles.update",
        "articles.delete"
    ],
};


const requirePermission = (permission) => {
    return (req, res, next) => {
        // Get permissions for the current user's role.
        const userPermissions = rolePermissions[req.user.role] || [];

        // Reject the request if the permission is missing.
        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                message: "Forbidden"
            });
        }

        // Continue when the permission is available.
        next();
    };
};
/////////////////////////////////////////////////////////////////

//عشان ما يتحكم بوزر باغراض يوزر ثاني
const requireArticleOwner = async (req, res, next) => {
        // Admin can manage any article.
        // المستخدم Admin يستطيع التحكم بأي Article.


    try {
        if (req.user.role === "ADMIN"||req.user.role === "MODERATOR") {
            return next();
        }

        // Read the article ID from the route parameter.
        // قراءة Article ID من الرابط
        const articleId = Number(req.params.id);

        // Find the article only if its owner is not soft-deleted.
        // البحث عن المقال إذا كان مالكه غير محذوف
        const article = await prisma.article.findFirst({
            where: {
                id: articleId,
                user: {
                    isDeleted: false
                }
            }
        });

        // Return 404 if the article does not exist.
        // إرجاع 404 إذا لم يكن المقال موجودًا
        if (!article) {
            return res.status(404).json({
                message: "Article not found",
                data: null
            });
        }

        // Check whether the authenticated user owns this article.
        // التأكد أن المقال تابع للمستخدم الحالي
        if (req.user.id !== article.userId) {
            return res.status(403).json({
                message: "Forbidden",
                data: null
            });
        }

        // Allow the request to continue.
        // السماح للطلب بالمتابعة
        next();

    } catch (err) {
        // Pass unexpected errors to the centralized error handler.
        // إرسال الأخطاء غير المتوقعة إلى Error Handler المركزي
        return next(err);
    }
};

//Authentcation : who must be loggedi in
//Authorization: who must be Admin

export {
    authMiddleware,
    requireAdmin,
    requireArticleOwner,
    requirePermission
};
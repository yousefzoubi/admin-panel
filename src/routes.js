import express from 'express';

import {
    registerUser,
    loginUser,
    verifyLoginOtpController,
    refreshAccessToken,
    logoutUser
} from './controllers/auth.controller.js';

import {
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    restoreUser,
    getUserWithArticles
} from './controllers/users.controller.js';

import {
    getArticles,
    insertArticle,
    getArticleById,
    updateArticle,
    deleteArticle,
    publishArticle,
    unpublishArticle
} from './controllers/articles.controller.js';

import {
    createConversation,
    getMyConversations,
    deleteConversation,
    getConversationMessages,
    createMessage,
    markConversationRead
} from './controllers/chat.controller.js';

import {
    getAuditLogs,
    getDashboardStats
} from './controllers/admin.controller.js';

import {
    authMiddleware,
    requireArticleOwner,
    requirePermission
} from './middlewares/auth.middleware.js';

import {
    validateUpdateUser,
    validateRegister,
    validateLogin,
    validateIdParam,
    validateRefreshToken,
    validateCreateArticle,
    validateUpdateArticle,
    validateCreateMessage,
    validateCreateConversation
} from './middlewares/validation.js';

const router = express.Router();

router.get(
    '/dashboard/stats',
    authMiddleware,
    getDashboardStats
);

router.get(
    '/audit-logs',
    authMiddleware,
    requirePermission("audit.read"),
    getAuditLogs
);

//Public Endpoints , no need for Authentication

router.post('/register', validateRegister, registerUser);
router.post('/login', validateLogin, loginUser);

router.post(
    '/login/verify-otp',
    verifyLoginOtpController
);


//Logout Endpoint , needs to be authentcated to user req.user.id from auth middleware

router.post(
    '/logout',
    authMiddleware,
    validateRefreshToken,
    logoutUser
);

// User Endpoints

//router.get('/users', authMiddleware, requireAdmin, getUsers);

router.get(
    '/users',
    authMiddleware,
    requirePermission("users.read"),
    getUsers
);

router.get(
    '/users/:id',
    authMiddleware,
    requirePermission("users.read"),
    validateIdParam("id"),
    getUserById
);

router.put(
    '/users/:id',
    authMiddleware,
    requirePermission("users.update"),
    validateIdParam("id"),
    validateUpdateUser,
    updateUser
);

router.delete(
    '/users/:id',
    authMiddleware,
    requirePermission("users.delete"),
    validateIdParam("id"),
    deleteUser
);

router.post(
    '/users/:id/restore',
    authMiddleware,
    requirePermission("users.restore"),
    validateIdParam("id"),
    restoreUser
);

// Article Endpoints

router.get(
    '/articles',
    authMiddleware,
    requirePermission("articles.read"),
    getArticles
);

router.post(
    '/articles',
    authMiddleware,
    requirePermission("articles.create"),
    validateCreateArticle,
    insertArticle
);

router.get(
    '/articles/:id',
    authMiddleware,
    requirePermission("articles.read"),
    validateIdParam("id"),
    getArticleById
);

router.put(
    '/articles/:id',
    authMiddleware,
    requirePermission("articles.update"),
    validateIdParam("id"),
    requireArticleOwner,
    validateUpdateArticle,
    updateArticle
);

router.patch(
    '/articles/:id/publish',
    authMiddleware,
    requirePermission("articles.publish"),
    validateIdParam("id"),
    requireArticleOwner,
    publishArticle
);

router.patch(
    '/articles/:id/unpublish',
    authMiddleware,
    requirePermission("articles.publish"),
    validateIdParam("id"),
    requireArticleOwner,
    unpublishArticle
);



router.delete(
    '/articles/:id',
    authMiddleware,
    requirePermission("articles.delete"),
    validateIdParam("id"),
    requireArticleOwner,
    deleteArticle
);

router.get(
    '/users/:id/articles',
    authMiddleware,
    requirePermission("articles.read"),
    validateIdParam("id"),
    getUserWithArticles
);

router.post(
    '/refresh',
    validateRefreshToken,
    refreshAccessToken
);
//no need for authMiddleware لانه الهدف اصلا اني اعمل توكن جديدة لانه عالاغلب بتكون منتهية
// authMiddleware verifies the access token to allow using protected endpoints, but we are here to make a new access token :P ,cuz our old access token is expired  زي اللي بده خبرة عشان يوظفك توخذ خبرة



router.post(
    '/conversations',
    authMiddleware,
    validateCreateConversation,
    createConversation
);
//لم نستخدم requirePermission هنا لأن أي مستخدم مسجل دخول يستطيع بدء محادثة حسب تصميمنا الحالي


router.get(
    '/conversations',
    authMiddleware,
    getMyConversations
);

router.delete(
    '/conversations/:id',
    authMiddleware,
    validateIdParam("id"),
    deleteConversation
);

router.get(
    '/conversations/:id/messages',
    authMiddleware,
    validateIdParam("id"),
    getConversationMessages
);


router.post(
    '/conversations/:id/messages',
    authMiddleware,
    validateIdParam("id"),
    validateCreateMessage,
    createMessage
);


// HTTP fallback for the read indicator, used when the Socket is not connected.
// بديل HTTP لمؤشر القراءة، يُستخدم لما يكون الـ Socket غير متصل
router.patch(
    '/conversations/:id/read',
    authMiddleware,
    validateIdParam("id"),
    markConversationRead
);





export default router;

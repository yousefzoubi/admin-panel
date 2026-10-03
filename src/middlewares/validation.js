const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getPasswordErrors = (password) => {
    const errors = [];

    if (password.length < 8) {
        errors.push("Password must be at least 8 characters");
    }

    if (!/[A-Z]/.test(password)) {
        errors.push("Password must contain an uppercase letter");
    }

    if (!/[a-z]/.test(password)) {
        errors.push("Password must contain a lowercase letter");
    }

    if (!/[0-9]/.test(password)) {
        errors.push("Password must contain a number");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push("Password must contain a special character");
    }

    return errors;
};



const validateRegister = (req, res, next) => {
    const {
        username,
        email,
        password
    } = req.body || {};

    //اوبجكت بجمع كل الاخطاء بداخله
    const errors = {};

    //trimming the username, email, password
    //check emailfromat  ,, has( @ )
    //check password length

    // Username validation
    if (typeof username !== "string" || username.trim() === "") {
        errors.username = "Username is required";
    }

    // Email validation
    if (typeof email !== "string" || email.trim() === "") {
        errors.email = "Email is required";
    } else if (!isValidEmail(email.trim())) {
        errors.email = "Email format is invalid";
    }

    // Password validation
    if (typeof password !== "string" || password.trim() === "") {
        errors.password = "Password is required";
    } else {
        const passwordErrors = getPasswordErrors(password);

        if (passwordErrors.length > 0) {
            errors.password = passwordErrors;
        }
    }

    // Return validation errors
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: "Validation failed",
            errors
        });
    }

    next();
};

const validateLogin = (req, res, next) => {
    const {
        email,
        password
    } = req.body || {};

    const errors = {};

    // Email validation
    if (typeof email !== "string" || email.trim() === "") {
        errors.email = "Email is required";
    } else if (!isValidEmail(email.trim())) {
        errors.email = "Email format is invalid";
    }

    // Password validation
    if (typeof password !== "string" || password.trim() === "") {
        errors.password = "Password is required";
    }

    // Return validation errors
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: "Validation failed",
            errors
        });
    }

    next();
};

//بين الفرونت والباك
// Reusable middleware factory for validating route parameters مثل:
// /users/:id
// /articles/:id
//
// paramName هو اسم الـ parameter الموجود داخل route
// مثال: validateIdParam("id")
const validateIdParam = (paramName = "id") => {
    // هذه Function ترجع Middleware جديد
    return (req, res, next) => {
        const rawId = req.params[paramName];

        const errors = {};

        // نتأكد أن الـ parameter موجود وليس فارغًا
        if (typeof rawId !== "string" || rawId.trim() === "") {
            errors[paramName] = `${paramName} is required`;
        } else {
            // Number يحاول تحويل القيمة إلى رقم
            const id = Number(rawId);

            // نتحقق أن القيمة:
            // 1. رقم صحيح Integer
            // 2. أكبر من صفر
            //
            // استخدمنا Number بدل parseInt لأن:
            // parseInt("12abc") يرجع 12 وهذا غير صحيح
            // Number("12abc") يرجع NaN ويتم رفضه
            if (!Number.isInteger(id) || id <= 0) {
                errors[paramName] = `${paramName} must be a positive integer`;
            }
        }

        // إذا وجدنا أخطاء، نوقف تنفيذ الـ request
        if (Object.keys(errors).length > 0) {
            return res.status(400).json({
                message: "Validation failed",
                errors
            });
        }

        // إذا كانت القيمة صحيحة، نسمح للطلب بالانتقال للـ middleware أو controller التالي
        next();
    };
};

const validateRefreshToken = (req, res, next) => {
    // Read refreshToken from the request body.
    // The fallback object prevents an error if req.body is undefined.
    const { refreshToken } = req.body || {};

    // This object stores all validation errors.
    const errors = {};

    // Check that refreshToken exists and is a non-empty string.
    if (typeof refreshToken !== "string" || refreshToken.trim() === "") {
        errors.refreshToken = "Refresh token is required";
    }

    // Stop the request if one or more validation errors exist.
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: "Validation failed",
            errors
        });
    }

    // Continue to the next middleware or controller.
    next();
};

const validateRequiredString = (value, fieldName, errors) => {
    // Check that the value is a string and is not empty.
    if (typeof value !== "string" || value.trim() === "") {
        errors[fieldName] = `${fieldName} is required`;
    }
};

const validateCreateArticle = (req, res, next) => {
    // Read article fields from the request body.
    const {
        titleAr,
        titleEn,
        contentAr,
        contentEn
    } = req.body || {};

    // This object stores all validation errors.
    const errors = {};

    // The article needs at least one title: Arabic or English.
    // المقال يحتاج عنوانًا واحدًا على الأقل، عربي أو إنجليزي.
    if (titleAr === undefined && titleEn === undefined) {
        errors.title = "At least one title is required";
    }

    // Validate a title only when the client sends it.
    // If it exists, it must be a non-empty string.
    if (titleAr !== undefined) {
        validateRequiredString(titleAr, "titleAr", errors);
    }

    if (titleEn !== undefined) {
        validateRequiredString(titleEn, "titleEn", errors);
    }

    // Content is optional, but if sent it must be valid.
    // المحتوى اختياري، لكن إن أرسله العميل يجب أن يكون نصًا صحيحًا وغير فارغ.
    if (contentAr !== undefined) {
        validateRequiredString(contentAr, "contentAr", errors);
    }

    if (contentEn !== undefined) {
        validateRequiredString(contentEn, "contentEn", errors);
    }

    // Stop the request if validation errors exist.
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: "Validation failed",
            errors
        });
    }

    // Continue to the controller.
    next();
};
const validateUpdateArticle = (req, res, next) => {
    // Read article fields from the request body.
    const {
        titleAr,
        titleEn,
        contentAr,
        contentEn
    } = req.body || {};

    // This object stores all validation errors.
    const errors = {};

    // Check whether the client sent at least one field.
    const hasNoFields =
        titleAr === undefined &&
        titleEn === undefined &&
        contentAr === undefined &&
        contentEn === undefined;

    // An update request must contain at least one field.
    if (hasNoFields) {
        errors.article = "At least one field is required";
    }

    // Validate only the fields sent by the client.
    if (titleAr !== undefined) {
        validateRequiredString(titleAr, "titleAr", errors);
    }

    if (titleEn !== undefined) {
        validateRequiredString(titleEn, "titleEn", errors);
    }

    if (contentAr !== undefined) {
        validateRequiredString(contentAr, "contentAr", errors);
    }

    if (contentEn !== undefined) {
        validateRequiredString(contentEn, "contentEn", errors);
    }

    // Stop the request if validation errors exist.
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: "Validation failed",
            errors
        });
    }

    // Continue to the controller.
    next();
};

const validateUpdateUser = (req, res, next) => {
    // Read the user fields sent by the client.
    const {
        username,
        email,
        password,
        role
    } = req.body || {};

    // This object stores all validation errors.
    const errors = {};

    // Check whether at least one field was sent.
    const hasNoFields =
        username === undefined &&
        email === undefined &&
        password === undefined &&
        role === undefined;

    // The update request must contain at least one field.
    if (hasNoFields) {
        errors.user = "At least one field is required";
    }

    // Validate username only if the client sent it.
    if (username !== undefined) {
        validateRequiredString(username, "username", errors);
    }

    // Validate email only if the client sent it.
    if (email !== undefined) {
        if (typeof email !== "string" || email.trim() === "") {
            errors.email = "Email is required";
        } else if (!isValidEmail(email.trim())) {
            errors.email = "Email format is invalid";
        }
    }

    // Validate password only if the client sent it.
    if (password !== undefined) {
        if (typeof password !== "string" || password.trim() === "") {
            errors.password = "Password is required";
        } else {
            const passwordErrors = getPasswordErrors(password);

            if (passwordErrors.length > 0) {
                errors.password = passwordErrors;
            }
        }
    }

    // Validate role only if the client sent it.
    if (role !== undefined) {
        const allowedRoles = [
            "USER",
            "EDITOR",
            "ADMIN"
        ];

        if (!allowedRoles.includes(role)) {
            errors.role = "Role must be either USER, EDITOR, or ADMIN";
        }
    }

    // Stop the request if validation errors exist.
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: "Validation failed",
            errors
        });
    }

    // Continue to the update controller.
    next();
};


const validateCreateConversation = (req, res, next) => {
    const { participantId } = req.body || {};
    if (
        typeof participantId !== "number" ||
        !Number.isInteger(participantId) ||
        participantId <= 0
    ) {
        return res.status(400).json({
            message: "participantId must be a positive integer",
            data: null
        });
    }
    next();
};


const validateCreateMessage = (req, res, next) => {

    // قراءة محتوى الرسالة من Body
    const { content } = req.body || {};

    // التأكد أن المحتوى نص ومش فاضي
    if (typeof content !== "string" || content.trim() === "") {
        return res.status(400).json({
            message: "Message content is required",
            data: null
        });
    }


    // منع الرسائل الكبيرة
    if (content.trim().length > 2000) {
        return res.status(400).json({
            message: "Message content must not exceed 2000 characters",
            data: null
        });
    }
    next();
};

const validateVerifyOtp = (req, res, next) => {
    // Read OTP verification data from the request body.
    // قراءة بيانات التحقق من OTP
    const {
        userId,
        otp
    } = req.body || {};

    // This object stores all validation errors.
    // هذا الكائن يجمع جميع أخطاء التحقق
    const errors = {};

    // User ID must be a positive integer.
    // يجب أن يكون User ID رقمًا صحيحًا وموجبًا
    if (!Number.isInteger(userId) || userId <= 0) {
        errors.userId = "Valid userId is required";
    }

    // OTP must be exactly six digits.
    // يجب أن يكون OTP مكوّنًا من ستة أرقام
    if (
        typeof otp !== "string" ||
        !/^\d{6}$/.test(otp.trim())
    ) {
        errors.otp = "OTP must contain exactly 6 digits";
    }

    // Stop the request if validation errors exist.
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({
            message: "Validation failed",
            errors
        });
    }

    // Continue to the Controller.
    next();
};


export {
    validateRegister,
    validateLogin,
    validateIdParam,
    validateRefreshToken,
    validateCreateArticle,
    validateUpdateArticle,
    validateUpdateUser,
    validateCreateConversation,
    validateCreateMessage,
    validateVerifyOtp
};
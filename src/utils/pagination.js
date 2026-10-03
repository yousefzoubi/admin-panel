const getPaginationParams = (req) => {

    // Read pagination values from the query string.
    // قراءة قيم Pagination من الرابط
    const requestedPage = Number(req.query.page);
    const requestedLimit = Number(req.query.limit);

    // Use page 1 when the value is invalid.
    // استخدام الصفحة الأولى إذا كانت القيمة غير صحيحة
    const page =
        Number.isInteger(requestedPage) && requestedPage > 0
            ? requestedPage
            : 1;

    // Keep the limit between 1 and 100.
    // إبقاء عدد النتائج بين 1 و100
    const limit =
        Number.isInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, 100)
            : 10;

    // Calculate how many records should be skipped.
    // حساب عدد السجلات التي سيتم تجاوزها
    const skip = (page - 1) * limit;

    // Return the calculated pagination values.
    // إرجاع قيم Pagination المحسوبة
    return {
        page,
        limit,
        skip
    };
};

export {
    getPaginationParams
};
const errorHandler = (err, req, res, next) => {
    // Log the complete error on the server.
    // This helps us debug unexpected problems.
    console.error(err);

    // If the response has already started, let Express handle the error.
    if (res.headersSent) {
        return next(err);
    }

    // Handle Prisma unique constraint errors.
    // Example: duplicate email or duplicate username.

    if (err.code === "P2002") {
        return res.status(409).json({
            message: "A record with this value already exists",
            data: null
        });
    }

    // Handle Prisma record-not-found errors.
    // This usually happens when updating or deleting a missing record.
    if (err.code === "P2025") {

        return res.status(404).json({
            message: "The requested record was not found",
            data: null
        });
    }

    // Handle Prisma foreign-key constraint errors.
    // This happens when a related record cannot be deleted or connected.
    if (err.code === "P2003") {
        return res.status(409).json({
            message: "This record is still connected to other data",
            data: null
        });
    }

    // Use a custom status code if the error provides one.
    // Otherwise, treat it as an unexpected server error.
    const statusCode = err.statusCode || 500;

    // Return a safe error response to the client.
    // Do not expose stack traces or internal server details:
    // only errors we created on purpose (4xx) show their message.
    return res.status(statusCode).json({
        message: statusCode < 500 ? err.message : "Internal server error",
        data: null
    });
};

export default errorHandler;


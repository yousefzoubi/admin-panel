import prisma from '../prismaClient.js';

const createAuditLog = async (userId, action, entity, entityId) => {
    await prisma.auditLog.create({ //new record in Auditlog table 
        data: {
            userId, // userId: userId, 
            action, // action: action,
            entity, // entity: entity,
            entityId // entityId: entityId
        }
    });
};

export {
    createAuditLog
};

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';

// Socket.io server instance
let io: Server | null = null;

// Token payload type
interface TokenPayload {
    userId: string;
    clinicId: string;
    organizationId: string;
    role: string;
}

// Extended socket with user data
interface AuthenticatedSocket extends Socket {
    userId?: string;
    clinicId?: string;
    organizationId?: string;
}

/**
 * Initialize Socket.io server with JWT authentication
 */
export function initializeWebSocket(httpServer: HttpServer): Server {
    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                const allowedOrigins = [
                    config.frontend.url,
                    'http://localhost:5173',
                    'http://localhost:5174',
                ];
                // Allow no-origin requests (mobile apps, curl, etc.)
                if (!origin) return callback(null, true);
                // Exact match
                if (allowedOrigins.includes(origin)) return callback(null, true);
                // Allow ngrok tunnels
                if (origin.endsWith('.ngrok-free.app')) return callback(null, true);

                // Allow subdomain-based multi-tenant origins
                try {
                    const url = new URL(origin);
                    const hostname = url.hostname;
                    // Dev: *.localhost:5173/5174
                    if (hostname.endsWith('.localhost') && ['5173', '5174', ''].includes(url.port)) {
                        return callback(null, true);
                    }
                    // Prod: *.cuspia.com
                    if (hostname.endsWith('.cuspia.com') || hostname === 'cuspia.com') {
                        return callback(null, true);
                    }
                } catch { /* ignore parse errors */ }

                callback(new Error('Not allowed by CORS'));
            },
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // JWT Authentication middleware
    io.use((socket: AuthenticatedSocket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                logger.warn({ socketId: socket.id }, 'WebSocket connection attempt without token');
                return next(new Error('Authentication required'));
            }

            // Verify JWT token
            const decoded = jwt.verify(token, config.jwt.accessSecret) as TokenPayload;

            // Attach user info to socket
            socket.userId = decoded.userId;
            socket.clinicId = decoded.clinicId;
            socket.organizationId = decoded.organizationId;

            next();
        } catch (error) {
            logger.warn({ socketId: socket.id, error }, 'WebSocket auth failed');
            next(new Error('Invalid token'));
        }
    });

    // Connection handling
    io.on('connection', (socket: AuthenticatedSocket) => {
        const organizationId = socket.organizationId;
        const userId = socket.userId;

        if (!organizationId || !userId) {
            logger.warn({ socketId: socket.id, userId }, 'No organizationId or userId, disconnecting');
            socket.disconnect();
            return;
        }

        // Join personal user room for targeted events
        const userRoom = `user:${userId}`;
        socket.join(userRoom);

        // Join organization room for general notifications
        const orgRoom = `org:${organizationId}`;
        socket.join(orgRoom);

        // Join clinic room for clinic-specific events (e.g. WhatsApp chatbot)
        const clinicId = socket.clinicId;
        const clinicRoom = clinicId ? `clinic:${clinicId}` : null;
        if (clinicRoom) socket.join(clinicRoom);

        logger.info({
            socketId: socket.id,
            userId,
            organizationId,
            clinicId,
            rooms: [userRoom, orgRoom, clinicRoom].filter(Boolean),
        }, '🔌 WebSocket client connected');

        // Handle joining an appointment room for real-time stock updates
        socket.on('join:appointment', async (data: { appointmentId: string }) => {
            const { appointmentId } = data;
            if (!appointmentId) {
                socket.emit('error', { message: 'appointmentId required' });
                return;
            }

            // Join the appointment room (access validation done on frontend via API)
            const appointmentRoom = `appointment:${appointmentId}`;
            socket.join(appointmentRoom);

            logger.info({
                socketId: socket.id,
                userId,
                appointmentId,
                room: appointmentRoom,
            }, '🔌 User joined appointment room');

            socket.emit('joined:appointment', { appointmentId, success: true });
        });

        // Handle leaving an appointment room
        socket.on('leave:appointment', (data: { appointmentId: string }) => {
            const { appointmentId } = data;
            if (!appointmentId) return;

            const appointmentRoom = `appointment:${appointmentId}`;
            socket.leave(appointmentRoom);

            logger.info({
                socketId: socket.id,
                userId,
                appointmentId,
                room: appointmentRoom,
            }, '🔌 User left appointment room');
        });

        // Handle joining a clinic room dynamically (for WhatsApp chatbot etc.)
        socket.on('join:clinic', (data: { clinicId: string }) => {
            const { clinicId: reqClinicId } = data;
            if (!reqClinicId) {
                socket.emit('error', { message: 'clinicId required' });
                return;
            }

            const room = `clinic:${reqClinicId}`;
            socket.join(room);

            logger.info({
                socketId: socket.id,
                userId,
                clinicId: reqClinicId,
                room,
            }, '🔌 User joined clinic room');

            socket.emit('joined:clinic', { clinicId: reqClinicId, success: true });
        });

        // Handle leaving a clinic room
        socket.on('leave:clinic', (data: { clinicId: string }) => {
            const { clinicId: reqClinicId } = data;
            if (!reqClinicId) return;

            const room = `clinic:${reqClinicId}`;
            socket.leave(room);

            logger.info({
                socketId: socket.id,
                userId,
                clinicId: reqClinicId,
                room,
            }, '🔌 User left clinic room');
        });

        // Handle disconnect
        socket.on('disconnect', (reason) => {
            logger.info({
                socketId: socket.id,
                userId,
                organizationId,
                reason,
            }, '🔌 WebSocket client disconnected');
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error({
                socketId: socket.id,
                userId,
                error,
            }, 'WebSocket error');
        });
    });

    logger.info('✅ WebSocket server initialized');

    return io;
}

/**
 * Get the Socket.io server instance
 */
export function getIO(): Server {
    if (!io) {
        throw new Error('WebSocket server not initialized');
    }
    return io;
}

/**
 * Emit event to all users in an organization room
 */
export function emitToOrganization(organizationId: string, event: string, data: unknown): void {
    if (!io) {
        logger.warn({ organizationId, event }, 'WebSocket not initialized, cannot emit');
        return;
    }

    const roomName = `org:${organizationId}`;
    io.to(roomName).emit(event, data);

    logger.debug({ organizationId, event, room: roomName }, 'Emitted WebSocket event to organization');
}

/**
 * Emit event to all users in a specific appointment room
 */
export function emitToAppointment(appointmentId: string, event: string, data: unknown): void {
    if (!io) {
        logger.warn({ appointmentId, event }, 'WebSocket not initialized, cannot emit');
        return;
    }

    const roomName = `appointment:${appointmentId}`;
    io.to(roomName).emit(event, data);

    logger.debug({ appointmentId, event, room: roomName }, 'Emitted WebSocket event to appointment room');
}

/**
 * Emit event to specific users by their IDs
 */
export function emitToUsers(userIds: string[], event: string, data: unknown): void {
    if (!io) {
        logger.warn({ userIds, event }, 'WebSocket not initialized, cannot emit');
        return;
    }

    // Emit to each user's personal room
    for (const userId of userIds) {
        const roomName = `user:${userId}`;
        io.to(roomName).emit(event, data);
    }

    logger.debug({ userIds, event }, 'Emitted WebSocket event to specific users');
}

/**
 * Emit event to all users in a specific clinic room
 */
export function emitToClinic(clinicId: string, event: string, data: unknown): void {
    if (!io) {
        logger.warn({ clinicId, event }, 'WebSocket not initialized, cannot emit');
        return;
    }

    const roomName = `clinic:${clinicId}`;
    io.to(roomName).emit(event, data);

    logger.debug({ clinicId, event, room: roomName }, 'Emitted WebSocket event to clinic room');
}

/**
 * Event emitters for appointments (emit only to assigned workers)
 */
export const appointmentEvents = {
    started: (workerIds: string[], appointment: unknown) => {
        emitToUsers(workerIds, 'appointment:started', { appointment });
    },

    completed: (workerIds: string[], appointmentId: string) => {
        emitToUsers(workerIds, 'appointment:completed', { appointmentId });
    },

    updated: (workerIds: string[], appointment: unknown) => {
        emitToUsers(workerIds, 'appointment:updated', { appointment });
    },
};

/**
 * Event emitters for stock (use appointment room for targeted updates)
 */
export const stockEvents = {
    updated: (appointmentId: string, items: unknown[]) => {
        emitToAppointment(appointmentId, 'stock:updated', { appointmentId, items });
    },
};

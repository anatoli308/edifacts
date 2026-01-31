/**
 * Socket.IO Job Event Handlers
 * =============================
 * Handles job subscription/unsubscription for real-time updates
 * 
 * Events:
 * - subscribe - Subscribe to job updates
 * - unsubscribe - Unsubscribe from job updates
 * 
 * Emits:
 * - subscribed - Confirmation of subscription
 * - unsubscribed - Confirmation of unsubscription
 */

/**
 * Register all job-related Socket.IO event handlers
 * @param {Socket} socket - Socket.IO socket instance
 */
export function registerJobHandlers(socket) {
    socket.on('subscribe', handleSubscribe(socket));
    socket.on('unsubscribe', handleUnsubscribe(socket));
}

/**
 * Job Subscription Handler
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Function} Event handler function
 */
function handleSubscribe(socket) {
    return ({ jobId }) => {
        if (!jobId) {
            console.warn(`[Socket ${socket.id}] Subscribe failed: missing jobId`);
            return;
        }
        console.log(`[Socket ${socket.id}] Subscribing to job: ${jobId}`);
        socket.join(`job:${jobId}`);
        socket.emit('subscribed', { jobId });
    };
}

/**
 * Job Unsubscription Handler
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Function} Event handler function
 */
function handleUnsubscribe(socket) {
    return ({ jobId }) => {
        if (!jobId) {
            console.warn(`[Socket ${socket.id}] Unsubscribe failed: missing jobId`);
            return;
        }
        console.log(`[Socket ${socket.id}] Unsubscribing from job: ${jobId}`);
        socket.leave(`job:${jobId}`);
        socket.emit('unsubscribed', { jobId });
    };
}

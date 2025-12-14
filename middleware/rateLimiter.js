/**
 * Rate Limiter Middleware
 * 
 * In-memory rate limiting with configurable limits per IP.
 * Can be upgraded to Redis for distributed environments.
 */

const config = require('../config');

// In-memory store for rate limiting
const requestCounts = new Map();

/**
 * Clean up expired entries periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requestCounts.entries()) {
        if (now > data.resetTime) {
            requestCounts.delete(key);
        }
    }
}, 60000); // Clean every minute

/**
 * Get client identifier (IP address)
 */
function getClientId(req) {
    return req.ip ||
        req.headers['x-forwarded-for']?.split(',')[0] ||
        req.connection?.remoteAddress ||
        'unknown';
}

/**
 * Rate limiting middleware
 * Limits requests per IP within a time window
 */
function rateLimiter(req, res, next) {
    const limits = config.rateLimiting;
    const clientId = getClientId(req);
    const now = Date.now();

    // Get or create rate limit data for this client
    let clientData = requestCounts.get(clientId);

    if (!clientData || now > clientData.resetTime) {
        // New window
        clientData = {
            count: 0,
            resetTime: now + limits.windowMs
        };
    }

    clientData.count++;
    requestCounts.set(clientId, clientData);

    // Set rate limit headers
    const remaining = Math.max(0, limits.maxRequests - clientData.count);
    const resetSeconds = Math.ceil((clientData.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', limits.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    // Check if limit exceeded
    if (clientData.count > limits.maxRequests) {
        res.setHeader('Retry-After', resetSeconds);
        return res.status(429).json({
            success: false,
            error: 'Too Many Requests',
            message: `Rate limit exceeded. Try again in ${resetSeconds} seconds.`,
            retryAfter: resetSeconds
        });
    }

    next();
}

module.exports = { rateLimiter };

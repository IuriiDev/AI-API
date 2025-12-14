/**
 * Job Store - In-memory storage for background jobs
 * 
 * Stores job status and results for async AI operations.
 * Jobs auto-expire after 1 hour.
 */

const crypto = require('crypto');

// Job status enum
const JobStatus = {
    QUEUED: 'queued',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

// In-memory job storage
const jobs = new Map();

// Job TTL (1 hour in ms)
const JOB_TTL = 60 * 60 * 1000;

/**
 * Clean up expired jobs periodically
 */
setInterval(() => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
        if (now - job.createdAt > JOB_TTL) {
            jobs.delete(id);
        }
    }
}, 5 * 60 * 1000); // Clean every 5 minutes

/**
 * Generate unique job ID
 */
function generateJobId() {
    return `job_${crypto.randomBytes(12).toString('hex')}`;
}

/**
 * Create a new job
 */
function createJob(input, model) {
    const id = generateJobId();
    const job = {
        id,
        status: JobStatus.QUEUED,
        input: input.substring(0, 100), // Store truncated for debugging
        model,
        text: null,
        error: null,
        raw: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    jobs.set(id, job);
    return job;
}

/**
 * Get job by ID
 */
function getJob(id) {
    return jobs.get(id) || null;
}

/**
 * Update job status
 */
function updateJob(id, updates) {
    const job = jobs.get(id);
    if (job) {
        Object.assign(job, updates, { updatedAt: Date.now() });
        jobs.set(id, job);
    }
    return job;
}

/**
 * Mark job as running
 */
function setJobRunning(id) {
    return updateJob(id, { status: JobStatus.RUNNING });
}

/**
 * Mark job as completed with result
 */
function setJobCompleted(id, text, raw = null) {
    return updateJob(id, {
        status: JobStatus.COMPLETED,
        text,
        raw
    });
}

/**
 * Mark job as failed with error
 */
function setJobFailed(id, error) {
    return updateJob(id, {
        status: JobStatus.FAILED,
        error: error.message || String(error)
    });
}

module.exports = {
    JobStatus,
    createJob,
    getJob,
    updateJob,
    setJobRunning,
    setJobCompleted,
    setJobFailed
};

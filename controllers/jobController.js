/**
 * Job Controller
 * 
 * Handles background job status polling
 * 
 * @module controllers/jobController
 */

const jobStore = require('../utils/jobStore');
const { APIError, ErrorCodes } = require('../middleware/errorHandler');

/**
 * GET /ai/jobs/:job_id
 * 
 * Poll background job status
 * 
 * @param {Object} req.params.job_id - Job ID to check
 * @returns {Object} Job status and result
 */
async function handleGetJob(req, res) {
    const { job_id } = req.params;

    if (!job_id) {
        throw new APIError('Job ID is required', 400, ErrorCodes.INVALID_INPUT);
    }

    const job = jobStore.getJob(job_id);

    if (!job) {
        throw new APIError(
            `Job not found: ${job_id}`,
            404,
            ErrorCodes.JOB_NOT_FOUND
        );
    }

    const response = {
        success: true,
        job_id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
    };

    // Include result for completed jobs
    if (job.status === 'completed') {
        response.text = job.result;
        response.content = job.result; // iOS compatibility
    }

    // Include error for failed jobs
    if (job.status === 'failed') {
        response.error = job.error;
    }

    res.json(response);
}

module.exports = { handleGetJob };

/**
 * Job Controller
 * 
 * Handles polling for background job status
 */

const jobStore = require('../utils/jobStore');
const { APIError } = require('../middleware/errorHandler');

/**
 * GET /ai/jobs/:job_id
 * 
 * Returns job status and result if complete
 */
async function handleGetJob(req, res) {
    const { job_id } = req.params;

    if (!job_id) {
        throw new APIError('Job ID is required', 400);
    }

    const job = jobStore.getJob(job_id);

    if (!job) {
        throw new APIError('Job not found', 404);
    }

    const response = {
        success: true,
        job_id: job.id,
        status: job.status
    };

    // Include text if completed
    if (job.status === jobStore.JobStatus.COMPLETED) {
        response.text = job.text;
        // Optionally include raw response
        if (req.query.include_raw === 'true') {
            response.raw = job.raw;
        }
    }

    // Include error if failed
    if (job.status === jobStore.JobStatus.FAILED) {
        response.error = job.error;
    }

    res.json(response);
}

module.exports = { handleGetJob };

/**
 * Job Controller
 * 
 * Handles background job status polling
 * 
 * @module controllers/jobController
 */

const jobStore = require('../utils/jobStore');
const { APIError, ErrorCodes } = require('../middleware/errorHandler');
const { extractDxf } = require('../utils/dxf');

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

    const hasFile = Boolean(job.fileBuffer && job.fileBuffer.length);

    // Include result for completed jobs
    if (job.status === 'completed') {
        response.text = job.text;
        response.content = job.text; // iOS compatibility
        response.has_file = hasFile;
        if (job.fileName) {
            response.file_name = job.fileName;
        }
        if (!hasFile) {
            const dxf = extractDxf(job.text);
            if (dxf) {
                response.dxf = dxf;
            }
        }
    }

    // Include error for failed jobs
    if (job.status === 'failed') {
        response.error = job.error;
    }

    res.json(response);
}

/**
 * GET /ai/jobs/:job_id/file
 *
 * Download a generated DXF file for a completed job.
 */
async function handleGetJobFile(req, res) {
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

    if (job.status !== 'completed' || !job.fileBuffer) {
        throw new APIError(
            'DXF file is not available for this job.',
            404,
            ErrorCodes.NOT_FOUND
        );
    }

    const fileName = String(job.fileName || 'drawing.dxf').replace(/"/g, '');
    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', job.fileBuffer.length);
    res.send(job.fileBuffer);
}

module.exports = { handleGetJob, handleGetJobFile };

const scoreProperty = {
    type: 'integer',
    minimum: 0,
    maximum: 100
};

const cvAnalysisSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        overall_score: scoreProperty,
        headline: { type: 'string' },
        summary: { type: 'string' },
        candidate_profile: {
            type: 'object',
            additionalProperties: false,
            properties: {
                target_role: { type: 'string' },
                seniority: { type: 'string' },
                experience_summary: { type: 'string' }
            },
            required: ['target_role', 'seniority', 'experience_summary']
        },
        breakdown: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    category: { type: 'string' },
                    score: scoreProperty,
                    status: { type: 'string' },
                    summary: { type: 'string' },
                    action_items: {
                        type: 'array',
                        items: { type: 'string' }
                    }
                },
                required: ['category', 'score', 'status', 'summary', 'action_items']
            }
        },
        strengths: {
            type: 'array',
            items: { type: 'string' }
        },
        priority_improvements: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    title: { type: 'string' },
                    rationale: { type: 'string' },
                    example: { type: 'string' }
                },
                required: ['title', 'rationale', 'example']
            }
        },
        ats_analysis: {
            type: 'object',
            additionalProperties: false,
            properties: {
                formatting_assessment: { type: 'string' },
                present_keywords: {
                    type: 'array',
                    items: { type: 'string' }
                },
                missing_keywords: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['formatting_assessment', 'present_keywords', 'missing_keywords']
        },
        role_matches: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    role: { type: 'string' },
                    match_score: scoreProperty,
                    reason: { type: 'string' }
                },
                required: ['role', 'match_score', 'reason']
            }
        },
        cover_letter_feedback: {
            type: 'object',
            additionalProperties: false,
            properties: {
                provided: { type: 'boolean' },
                score: scoreProperty,
                summary: { type: 'string' },
                improvements: {
                    type: 'array',
                    items: { type: 'string' }
                }
            },
            required: ['provided', 'score', 'summary', 'improvements']
        },
        final_recommendation: { type: 'string' }
    },
    required: [
        'overall_score',
        'headline',
        'summary',
        'candidate_profile',
        'breakdown',
        'strengths',
        'priority_improvements',
        'ats_analysis',
        'role_matches',
        'cover_letter_feedback',
        'final_recommendation'
    ]
};

module.exports = cvAnalysisSchema;

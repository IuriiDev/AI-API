/**
 * Extract ASCII DXF from a model response.
 * Accepts raw DXF or markdown-fenced ```dxf blocks.
 *
 * @param {string} text
 * @returns {string|null}
 */
function extractDxf(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    let candidate = text.trim().replace(/^\uFEFF/, '');
    const fenced = candidate.match(/```(?:dxf)?\s*([\s\S]*?)```/i);
    if (fenced) {
        candidate = fenced[1].trim();
    }

    candidate = candidate.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const upper = candidate.toUpperCase();
    const hasEntities = upper.includes('ENTITIES');
    const hasEof = /(^|\n)\s*EOF\s*$/.test(upper) || /(^|\n)\s*0\s*\n\s*EOF\s*$/.test(upper);
    const hasSection = upper.includes('SECTION');

    if (!hasEntities || !hasEof || !hasSection) {
        return null;
    }

    return candidate.endsWith('\n') ? candidate : `${candidate}\n`;
}

module.exports = { extractDxf };

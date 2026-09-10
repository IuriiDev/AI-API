/**
 * Build a complete AutoCAD R2004 (AC1018) DXF from drawing entities.
 * Autodesk rejects hand-written minimal DXF containers even when geometry is valid.
 */

const ALLOWED = new Set(['LINE', 'LWPOLYLINE', 'CIRCLE', 'ARC', 'TEXT', 'MTEXT']);

function toAutoCADCompatibleDxf(input) {
    const source = bufferToText(input);
    const entities = extractEntities(source);
    if (entities.length === 0) {
        throw new Error('No LINE, ARC, CIRCLE, TEXT, or LWPOLYLINE entities were found.');
    }
    return Buffer.from(writeDocument(entities), 'utf8');
}

function bufferToText(input) {
    if (Buffer.isBuffer(input)) {
        return input.toString('utf8');
    }
    if (typeof input === 'string') {
        return input;
    }
    throw new Error('DXF content is missing.');
}

function extractEntities(text) {
    const values = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
        .map(line => line.trim());
    const pairs = [];
    for (let index = 0; index + 1 < values.length; index += 2) {
        pairs.push({ code: values[index], value: values[index + 1] });
    }

    let insideEntities = false;
    let current = [];
    const entities = [];

    const flush = () => {
        const type = current[0]?.value?.toUpperCase();
        if (current[0]?.code === '0' && ALLOWED.has(type)) {
            const parsed = parseEntity(type, current);
            if (parsed) {
                entities.push(parsed);
            }
        }
        current = [];
    };

    for (const pair of pairs) {
        if (pair.code === '0' && pair.value.toUpperCase() === 'SECTION') {
            insideEntities = false;
            continue;
        }
        if (pair.code === '2' && pair.value.toUpperCase() === 'ENTITIES') {
            insideEntities = true;
            continue;
        }
        if (pair.code === '0' && pair.value.toUpperCase() === 'ENDSEC') {
            if (insideEntities) {
                flush();
            }
            insideEntities = false;
            continue;
        }
        if (!insideEntities) {
            continue;
        }
        if (pair.code === '0') {
            flush();
        }
        current.push(pair);
    }
    if (insideEntities) {
        flush();
    }
    return entities;
}

function parseEntity(type, pairs) {
    const layer = pairValue(pairs, '8') || '0';
    const color = Number.parseInt(pairValue(pairs, '62') || '7', 10) || 7;
    if (type === 'LINE') {
        const startX = num(pairs, '10');
        const startY = num(pairs, '20');
        const endX = num(pairs, '11');
        const endY = num(pairs, '21');
        if (startX === null || endX === null) {
            return null;
        }
        return { type: 'LINE', layer, color, startX, startY: startY || 0, endX, endY: endY || 0 };
    }
    if (type === 'CIRCLE') {
        const radius = num(pairs, '40');
        if (!radius || radius <= 0) {
            return null;
        }
        return { type: 'CIRCLE', layer, color, x: num(pairs, '10') || 0, y: num(pairs, '20') || 0, radius };
    }
    if (type === 'ARC') {
        const radius = num(pairs, '40');
        if (!radius || radius <= 0) {
            return null;
        }
        return {
            type: 'ARC',
            layer,
            color,
            x: num(pairs, '10') || 0,
            y: num(pairs, '20') || 0,
            radius,
            start: num(pairs, '50') || 0,
            end: num(pairs, '51') || 0
        };
    }
    if (type === 'TEXT' || type === 'MTEXT') {
        const value = (pairValue(pairs, '1') || '') + (pairValue(pairs, '3') || '');
        if (!value.trim()) {
            return null;
        }
        return {
            type: 'TEXT',
            layer,
            color,
            x: num(pairs, '10') || 0,
            y: num(pairs, '20') || 0,
            height: num(pairs, '40') || 2.5,
            value: value.replace(/\\P/g, ' ')
        };
    }
    if (type === 'LWPOLYLINE') {
        const points = [];
        let pendingX = null;
        let closed = false;
        for (const pair of pairs) {
            if (pair.code === '70') {
                closed = (Number.parseInt(pair.value, 10) || 0) & 1;
            }
            if (pair.code === '10') {
                pendingX = Number.parseFloat(pair.value);
            }
            if (pair.code === '20' && pendingX !== null) {
                points.push({ x: pendingX, y: Number.parseFloat(pair.value) || 0 });
                pendingX = null;
            }
        }
        if (points.length < 2) {
            return null;
        }
        return { type: 'LWPOLYLINE', layer, color, points, closed };
    }
    return null;
}

function pairValue(pairs, code) {
    const found = pairs.find(pair => pair.code === code);
    return found ? found.value : null;
}

function num(pairs, code) {
    const value = pairValue(pairs, code);
    if (value === null || value === undefined || value === '') {
        return null;
    }
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function writeDocument(entities) {
    const layers = collectLayers(entities);
    let nextHandle = 0x100;
    const alloc = () => (nextHandle++).toString(16).toUpperCase();
    const layerHandles = {};
    for (const layer of layers) {
        layerHandles[layer.name] = alloc();
    }
    const entityHandles = entities.map(() => alloc());
    const handseed = (nextHandle + 16).toString(16).toUpperCase();
    const out = [];
    const p = (code, value) => {
        out.push(String(code), String(value));
    };

    p(0, 'SECTION');
    p(2, 'HEADER');
    p(9, '$ACADVER'); p(1, 'AC1018');
    p(9, '$ACADMAINTVER'); p(70, 0);
    p(9, '$DWGCODEPAGE'); p(3, 'ANSI_1252');
    p(9, '$INSBASE'); p(10, 0.0); p(20, 0.0); p(30, 0.0);
    p(9, '$EXTMIN'); p(10, 0.0); p(20, 0.0); p(30, 0.0);
    p(9, '$EXTMAX'); p(10, 1.0); p(20, 1.0); p(30, 0.0);
    p(9, '$LIMMIN'); p(10, 0.0); p(20, 0.0);
    p(9, '$LIMMAX'); p(10, 420.0); p(20, 297.0);
    p(9, '$ORTHOMODE'); p(70, 0);
    p(9, '$FILLMODE'); p(70, 1);
    p(9, '$QTEXTMODE'); p(70, 0);
    p(9, '$REGENMODE'); p(70, 1);
    p(9, '$LUNITS'); p(70, 2);
    p(9, '$LUPREC'); p(70, 4);
    p(9, '$INSUNITS'); p(70, 4);
    p(9, '$MEASUREMENT'); p(70, 1);
    p(9, '$LTSCALE'); p(40, 1.0);
    p(9, '$TEXTSTYLE'); p(7, 'Standard');
    p(9, '$CLAYER'); p(8, '0');
    p(9, '$HANDSEED'); p(5, handseed);
    p(0, 'ENDSEC');

    p(0, 'SECTION');
    p(2, 'CLASSES');
    p(0, 'ENDSEC');

    p(0, 'SECTION');
    p(2, 'TABLES');

    p(0, 'TABLE');
    p(2, 'VPORT');
    p(5, '8');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, 1);
    p(0, 'VPORT');
    p(5, alloc());
    p(330, '8');
    p(100, 'AcDbSymbolTableRecord');
    p(100, 'AcDbViewportTableRecord');
    p(2, '*ACTIVE');
    p(70, 0);
    p(10, 0.0); p(20, 0.0);
    p(11, 1.0); p(21, 1.0);
    p(12, 0.0); p(22, 0.0);
    p(13, 0.0); p(23, 0.0);
    p(14, 0.5); p(24, 0.5);
    p(15, 0.5); p(25, 0.5);
    p(16, 0.0); p(26, 0.0); p(36, 1.0);
    p(17, 0.0); p(27, 0.0); p(37, 0.0);
    p(40, 1000.0);
    p(41, 1.34);
    p(42, 50.0);
    p(43, 0.0);
    p(44, 0.0);
    p(50, 0.0);
    p(51, 0.0);
    p(71, 0);
    p(72, 100);
    p(73, 1);
    p(74, 3);
    p(75, 0);
    p(76, 1);
    p(77, 0);
    p(78, 0);
    p(0, 'ENDTAB');

    p(0, 'TABLE');
    p(2, 'LTYPE');
    p(5, '5');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, 3);
    writeLinetype(p, '14', 'ByBlock', '');
    writeLinetype(p, '15', 'ByLayer', '');
    writeLinetype(p, '16', 'Continuous', 'Solid line');
    p(0, 'ENDTAB');

    p(0, 'TABLE');
    p(2, 'LAYER');
    p(5, '2');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, layers.length);
    for (const layer of layers) {
        p(0, 'LAYER');
        p(5, layerHandles[layer.name]);
        p(330, '2');
        p(100, 'AcDbSymbolTableRecord');
        p(100, 'AcDbLayerTableRecord');
        p(2, layer.name);
        p(70, 0);
        p(62, layer.color);
        p(6, 'Continuous');
        p(370, -3);
        p(390, 'F');
    }
    p(0, 'ENDTAB');

    p(0, 'TABLE');
    p(2, 'STYLE');
    p(5, '3');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, 1);
    p(0, 'STYLE');
    p(5, alloc());
    p(330, '3');
    p(100, 'AcDbSymbolTableRecord');
    p(100, 'AcDbTextStyleTableRecord');
    p(2, 'Standard');
    p(70, 0);
    p(40, 0.0);
    p(41, 1.0);
    p(50, 0.0);
    p(71, 0);
    p(42, 2.5);
    p(3, 'txt');
    p(4, '');
    p(0, 'ENDTAB');

    p(0, 'TABLE');
    p(2, 'VIEW');
    p(5, '6');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, 0);
    p(0, 'ENDTAB');

    p(0, 'TABLE');
    p(2, 'UCS');
    p(5, '7');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, 0);
    p(0, 'ENDTAB');

    p(0, 'TABLE');
    p(2, 'APPID');
    p(5, '9');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, 1);
    p(0, 'APPID');
    p(5, '12');
    p(330, '9');
    p(100, 'AcDbSymbolTableRecord');
    p(100, 'AcDbRegAppTableRecord');
    p(2, 'ACAD');
    p(70, 0);
    p(0, 'ENDTAB');

    p(0, 'TABLE');
    p(2, 'DIMSTYLE');
    p(5, 'A');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, 1);
    p(100, 'AcDbDimStyleTable');
    p(71, 1);
    p(0, 'DIMSTYLE');
    p(105, alloc());
    p(330, 'A');
    p(100, 'AcDbSymbolTableRecord');
    p(100, 'AcDbDimStyleTableRecord');
    p(2, 'Standard');
    p(70, 0);
    p(40, 1.0);
    p(41, 2.5);
    p(42, 0.625);
    p(43, 3.75);
    p(44, 1.25);
    p(140, 2.5);
    p(144, 1.0);
    p(147, 0.625);
    p(340, '3');
    p(0, 'ENDTAB');

    p(0, 'TABLE');
    p(2, 'BLOCK_RECORD');
    p(5, '1');
    p(330, '0');
    p(100, 'AcDbSymbolTable');
    p(70, 2);
    p(0, 'BLOCK_RECORD');
    p(5, '1F');
    p(330, '1');
    p(100, 'AcDbSymbolTableRecord');
    p(100, 'AcDbBlockTableRecord');
    p(2, '*Model_Space');
    p(0, 'BLOCK_RECORD');
    p(5, '1E');
    p(330, '1');
    p(100, 'AcDbSymbolTableRecord');
    p(100, 'AcDbBlockTableRecord');
    p(2, '*Paper_Space');
    p(0, 'ENDTAB');
    p(0, 'ENDSEC');

    p(0, 'SECTION');
    p(2, 'BLOCKS');
    writeBlock(p, '20', '21', '1F', '*Model_Space');
    writeBlock(p, '1C', '1D', '1E', '*Paper_Space');
    p(0, 'ENDSEC');

    p(0, 'SECTION');
    p(2, 'ENTITIES');
    entities.forEach((entity, index) => writeEntity(p, entity, entityHandles[index]));
    p(0, 'ENDSEC');

    p(0, 'SECTION');
    p(2, 'OBJECTS');
    p(0, 'DICTIONARY');
    p(5, 'C');
    p(330, '0');
    p(100, 'AcDbDictionary');
    p(281, 1);
    p(3, 'ACAD_GROUP');
    p(350, 'D');
    p(0, 'DICTIONARY');
    p(5, 'D');
    p(330, 'C');
    p(100, 'AcDbDictionary');
    p(281, 1);
    p(0, 'ENDSEC');
    p(0, 'EOF');

    return `${out.join('\n')}\n`;
}

function writeLinetype(p, handle, name, description) {
    p(0, 'LTYPE');
    p(5, handle);
    p(330, '5');
    p(100, 'AcDbSymbolTableRecord');
    p(100, 'AcDbLinetypeTableRecord');
    p(2, name);
    p(70, 0);
    p(3, description);
    p(72, 65);
    p(73, 0);
    p(40, 0.0);
}

function writeBlock(p, blockHandle, endHandle, owner, name) {
    p(0, 'BLOCK');
    p(5, blockHandle);
    p(330, owner);
    p(100, 'AcDbEntity');
    p(8, '0');
    p(100, 'AcDbBlockBegin');
    p(2, name);
    p(70, 0);
    p(10, 0.0); p(20, 0.0); p(30, 0.0);
    p(3, name);
    p(1, '');
    p(0, 'ENDBLK');
    p(5, endHandle);
    p(330, owner);
    p(100, 'AcDbEntity');
    p(8, '0');
    p(100, 'AcDbBlockEnd');
}

function writeEntity(p, entity, handle) {
    p(0, entity.type === 'TEXT' ? 'TEXT' : entity.type);
    p(5, handle);
    p(330, '1F');
    p(100, 'AcDbEntity');
    p(8, entity.layer);
    p(6, 'Continuous');
    p(62, clampColor(entity.color));
    p(370, -1);
    if (entity.type === 'LINE') {
        p(100, 'AcDbLine');
        p(10, fmt(entity.startX)); p(20, fmt(entity.startY)); p(30, 0.0);
        p(11, fmt(entity.endX)); p(21, fmt(entity.endY)); p(31, 0.0);
        return;
    }
    if (entity.type === 'CIRCLE') {
        p(100, 'AcDbCircle');
        p(10, fmt(entity.x)); p(20, fmt(entity.y)); p(30, 0.0);
        p(40, fmt(entity.radius));
        return;
    }
    if (entity.type === 'ARC') {
        p(100, 'AcDbCircle');
        p(10, fmt(entity.x)); p(20, fmt(entity.y)); p(30, 0.0);
        p(40, fmt(entity.radius));
        p(100, 'AcDbArc');
        p(50, fmt(entity.start));
        p(51, fmt(entity.end));
        return;
    }
    if (entity.type === 'TEXT') {
        p(100, 'AcDbText');
        p(10, fmt(entity.x)); p(20, fmt(entity.y)); p(30, 0.0);
        p(40, fmt(entity.height));
        p(1, entity.value);
        p(7, 'Standard');
        p(100, 'AcDbText');
        return;
    }
    p(100, 'AcDbPolyline');
    p(90, entity.points.length);
    p(70, entity.closed ? 1 : 0);
    for (const point of entity.points) {
        p(10, fmt(point.x));
        p(20, fmt(point.y));
    }
}

function collectLayers(entities) {
    const colors = {
        0: 7,
        WALLS: 7,
        WINDOWS: 5,
        DOORS: 3,
        FURNITURE: 6,
        FIXTURES: 4,
        DIMENSIONS: 1,
        TEXT: 2,
        DETAILS: 7
    };
    const seen = new Map();
    seen.set('0', 7);
    for (const entity of entities) {
        const name = entity.layer || '0';
        if (!seen.has(name)) {
            seen.set(name, colors[name] || clampColor(entity.color));
        }
    }
    return [...seen.entries()].map(([name, color]) => ({ name, color }));
}

function clampColor(color) {
    return color >= 1 && color <= 255 ? color : 7;
}

function fmt(value) {
    return Number.parseFloat(value).toFixed(6).replace(/\.?0+$/, '') || '0';
}

module.exports = { toAutoCADCompatibleDxf };

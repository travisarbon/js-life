/**
 * Shared test helpers for loading ES module source files in Jest.
 * Strips import/export statements so files can be evaluated with new Function().
 */
const fs = require('fs');
const path = require('path');

function loadSource(relativePath) {
    const fullPath = path.join(__dirname, '..', relativePath);
    let src = fs.readFileSync(fullPath, 'utf8');
    // Strip ES module import statements
    src = src.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
    src = src.replace(/^import\s+['"].*?['"];?\s*$/gm, '');
    // Strip ES module export statements
    src = src.replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
    src = src.replace(/^export\s+default\s+/gm, '');
    return src;
}

function loadSources(relativePaths) {
    return relativePaths.map(loadSource).join('\n');
}

module.exports = { loadSource, loadSources };

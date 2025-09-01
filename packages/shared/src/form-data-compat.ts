/**
 * FormData and Blob compatibility layer for Node.js v16+
 * This module provides backwards compatibility for FormData and Blob APIs
 */

// Check Node.js version to determine which implementation to use
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

let FormDataCompat: any;
let BlobCompat: any;

if (majorVersion >= 18) {
    // Node.js 18+ has native FormData and Blob support
    try {
        // Try to use native FormData first (available globally in Node 18+)
        FormDataCompat = globalThis.FormData;
        BlobCompat = globalThis.Blob;
        
        if (!FormDataCompat || !BlobCompat) {
            throw new Error('Native FormData/Blob not available');
        }
    } catch {
        // Fallback to formdata-node for Node 18+ if native fails
        const formdataNode = require('formdata-node');
        const nodeBuffer = require('node:buffer');
        FormDataCompat = formdataNode.FormData;
        BlobCompat = nodeBuffer.Blob;
    }
} else {
    // Node.js 16-17: Use polyfill for FormData, node:buffer for Blob
    try {
        const formdataPolyfill = require('formdata-polyfill');
        const nodeBuffer = require('node:buffer');
        FormDataCompat = formdataPolyfill.FormData;
        BlobCompat = nodeBuffer.Blob;
    } catch {
        // Fallback to formdata-node if polyfill fails
        const formdataNode = require('formdata-node');
        const nodeBuffer = require('node:buffer');
        FormDataCompat = formdataNode.FormData;
        BlobCompat = nodeBuffer.Blob;
    }
}

export { FormDataCompat as FormData, BlobCompat as Blob };

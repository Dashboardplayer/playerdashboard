import { Buffer } from 'buffer';
import process from 'process';
import cryptoBrowserify from 'crypto-browserify';
import stream from 'stream-browserify';
import path from 'path-browserify';
import os from 'os-browserify/browser';

// Make non-protected globals available
window.Buffer = Buffer;
window.process = process;
window.stream = stream;
window.path = path;
window.os = os;

// For crypto, we'll export it for direct usage rather than trying to set it on window
const crypto = cryptoBrowserify;

// Export all polyfills for direct import where needed
export { Buffer, process, crypto, stream, path, os }; 
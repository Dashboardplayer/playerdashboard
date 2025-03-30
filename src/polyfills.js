// Import from our local polyfills
import { Buffer } from './polyfills/buffer';
import process from './polyfills/process';
import crypto from './polyfills/crypto';
import stream from 'stream-browserify';
import path from 'path-browserify';
import os from 'os-browserify/browser';

// Make non-protected globals available
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
  window.process = window.process || process;
}

// For crypto, we'll export it for direct usage rather than trying to set it on window
const cryptoBrowserify = crypto;

// Export all polyfills for direct import where needed
export { Buffer, process, cryptoBrowserify, stream, path, os }; 
import { Buffer } from 'buffer';
import process from 'process/browser.js';

window.Buffer = Buffer;
window.process = process;

// Ensure process.env is available
if (!window.process.env) {
  window.process.env = {};
} 
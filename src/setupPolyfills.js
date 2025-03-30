// Import required polyfills
import { Buffer } from 'buffer';
import process from 'process';

// Make polyfills available globally
window.global = window;
window.process = process;
window.Buffer = Buffer;

// Export for direct usage if needed
export { Buffer, process }; 
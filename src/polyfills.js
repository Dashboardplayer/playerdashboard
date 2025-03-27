import { Buffer } from 'buffer';
import process from 'process';
import cryptoPolyfill from './crypto-polyfill';

// Basic polyfills
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer;
  window.process = window.process || process;

  // Handle crypto polyfill
  if (window.crypto) {
    Object.keys(cryptoPolyfill).forEach(key => {
      if (typeof window.crypto[key] === 'undefined') {
        try {
          if (typeof cryptoPolyfill[key] === 'function') {
            Object.defineProperty(window.crypto, key, {
              enumerable: true,
              configurable: true,
              writable: true,
              value: cryptoPolyfill[key].bind(cryptoPolyfill)
            });
          }
        } catch (e) {
          console.warn(`Could not add ${key} to window.crypto:`, e);
        }
      }
    });
  }
} 
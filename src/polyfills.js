import { Buffer } from 'buffer';
import process from 'process';
import streamBrowserify from 'stream-browserify';
import util from 'util';
import assert from 'assert';
import http from 'stream-http';
import https from 'https-browserify';
import os from 'os-browserify/browser';
import url from 'url';
import path from 'path-browserify';
import consoleBrowserify from 'console-browserify';

// Safe assignments that won't conflict with browser APIs
window.Buffer = window.Buffer || Buffer;
window.process = window.process || process;
window.streamBrowserify = streamBrowserify;
window.util = window.util || util;
window.assert = window.assert || assert;
window.http = window.http || http;
window.https = window.https || https;
window.os = window.os || os;
window.url = window.url || url;
window.path = window.path || path;

// Handle console polyfill
Object.keys(consoleBrowserify).forEach(key => {
  if (typeof console[key] === 'undefined') {
    console[key] = consoleBrowserify[key];
  }
});

// Handle crypto polyfill
if (typeof window !== 'undefined' && window.crypto) {
  const cryptoBrowserify = require('crypto-browserify');
  
  // Create a new object that includes both native crypto and our polyfill
  const cryptoPolyfill = {
    ...cryptoBrowserify,
    // Preserve any existing native crypto methods
    ...(window.crypto || {}),
  };

  // Add missing methods from crypto-browserify to window.crypto
  Object.keys(cryptoBrowserify).forEach(key => {
    if (typeof window.crypto[key] === 'undefined') {
      try {
        if (typeof cryptoBrowserify[key] === 'function') {
          // For methods, we need to bind to maintain context
          Object.defineProperty(window.crypto, key, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: cryptoBrowserify[key].bind(cryptoBrowserify)
          });
        }
      } catch (e) {
        console.warn(`Could not add ${key} to window.crypto:`, e);
      }
    }
  });

  // Export the polyfill for use in other files
  window.cryptoPolyfill = cryptoPolyfill;
} 
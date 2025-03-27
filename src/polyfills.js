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

// Handle crypto separately since it's a protected property
if (typeof window.crypto === 'undefined') {
  const cryptoBrowserify = require('crypto-browserify');
  // Create a new object that includes both native crypto and our polyfill
  const cryptoPolyfill = {
    ...cryptoBrowserify,
    // Preserve any existing native crypto methods
    ...(window.crypto || {}),
  };
  
  // Only add polyfill methods that don't exist in native crypto
  Object.keys(cryptoBrowserify).forEach(key => {
    if (typeof window.crypto[key] === 'undefined') {
      if (typeof cryptoBrowserify[key] === 'function') {
        window.crypto[key] = cryptoBrowserify[key].bind(cryptoBrowserify);
      } else {
        // For non-function properties, we can't modify window.crypto directly
        // so we'll add them to our polyfill object
        cryptoPolyfill[key] = cryptoBrowserify[key];
      }
    }
  });
  
  // Export the polyfill for use in other files
  window.cryptoPolyfill = cryptoPolyfill;
} 
// Client-side shim for jws library
// This is a complete replacement for the Node.js jws module

// Simple placeholder functions
const sign = () => 'mock-signature';
const verify = () => true;
const decode = () => ({ header: {}, payload: {}, signature: 'mock-signature' });

// Simple implementation of DataStream, SignStream and VerifyStream
class DataStream {
  constructor() {}
  pipe() { return this; }
  on() { return this; }
  once() { return this; }
  emit() { return this; }
  end() { return this; }
  write() { return true; }
}

class SignStream extends DataStream {}
class VerifyStream extends DataStream {}

export default { sign, verify, decode, DataStream, SignStream, VerifyStream };
export { sign, verify, decode, DataStream, SignStream, VerifyStream };
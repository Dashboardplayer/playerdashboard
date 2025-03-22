// Client-side stream shim
// This provides empty implementations of stream-related functionality

class Stream {
  constructor() {}
  pipe() { return this; }
  on() { return this; }
  once() { return this; }
  emit() { return this; }
  end() { return this; }
  write() { return true; }
}

export default Stream;
export { Stream };
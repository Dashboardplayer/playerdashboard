// Client-side shim for inherits module
// A simplified version of the inherits functionality

function inherits(ctor, superCtor) {
  if (superCtor) {
    ctor.super_ = superCtor;
    Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
  }
}

module.exports = inherits;
module.exports.inherits = inherits;
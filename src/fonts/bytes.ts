// Read typed-array slots across realms without invoking overridden instance
// properties. The returned view has a fixed extent even on a growable buffer.
const prototype = Object.getPrototypeOf(Uint8Array.prototype);
const getter = (key: PropertyKey) =>
  Object.getOwnPropertyDescriptor(prototype, key)!.get!;
const nameOf = getter(Symbol.toStringTag),
  bufferOf = getter("buffer"),
  offsetOf = getter("byteOffset"),
  lengthOf = getter("byteLength");

export function fontByteView(
  value: unknown,
  allowClamped = false,
): Uint8Array | undefined {
  try {
    const name = nameOf.call(value);
    if (
      name !== "Uint8Array" &&
      !(allowClamped && name === "Uint8ClampedArray")
    )
      return undefined;
    return new Uint8Array(
      bufferOf.call(value),
      offsetOf.call(value),
      lengthOf.call(value),
    );
  } catch {
    return undefined;
  }
}

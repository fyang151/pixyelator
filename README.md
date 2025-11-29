## Pixyelator is a pixelation tool built for the browser.

More specifically, it was built for [nearsight.cc](nearsight.cc).
See another demo [here](https://fyang151.github.io/pixyelator/).

Pixyelator gets its very creative name because you control exactly how many _x_ and _y_ pixels there are.

### Usage Example

```javascript
// Create a new Pixyelator instance from an image
// This will draw results to targetCanvas
const pixyelator = await Pixyelator.fromImage(
  "https://cdn.britannica.com/83/28383-050-33D8DB80/Beaver.jpg",
  {
    targetCanvas: document.getElementById("targetCanvas"),
    maxWorkers: 4,
  }
);
const pixelatedImageDataURL = await pixyelator.pixelate(4, 4).toDataURL();
// Dispose of the instance when you're done
pixyelator.dispose();
```

### Methods

_What kind of method is this?: `Pixyelator.fromImage(source, options?)`_

This is a factory method for creating a new Pixyelator instance from an image source. Accepts a URL, data URL, `Blob`, `ArrayBuffer`, or `HTMLImageElement`. Returns a `Promise<Pixyelator>`.

_What kind of method is this?: `pixelate(xPixels, yPixels, options?)`_

This is the pixelation method. It pixelates the image into the specified number of horizontal and vertical blocks. Returns a chainable promise. You can call `.toBlob()`, `.toCanvas()`, `.toDataURL()`, or `.toArrayBuffer()` directly on the result. Pass `{ grayscale: true }` in options to convert to grayscale.

_What kind of method is this?: `toCanvas()`_

This is an output method. It returns the `HTMLCanvasElement` containing the pixelated image.

_What kind of method is this?: `toBlob()`_

This is an output method. It converts the pixelated image to a `Blob`. Returns a `Promise<Blob>`.

_What kind of method is this?: `toDataURL()`_

This is an output method. It converts the pixelated image to a data URL string.

_What kind of method is this?: `toArrayBuffer()`_

This is an output method. It converts the pixelated image to an `ArrayBuffer`. Returns a `Promise<ArrayBuffer>`.

_What kind of method is this?: `dispose()`_

This is a cleanup method. It cleans up resources and disposes of the instance. Call this when you're done to free memory.

### Options

_What kind of option is this?: `maxWorkers`_

This is a `fromImage` option. It sets the maximum number of web workers for parallel processing. Defaults to `navigator.hardwareConcurrency` or `4`.

_What kind of option is this?: `targetCanvas`_

This is a `fromImage` option. It sets the canvas to render results to. Defaults to a new canvas.

_What kind of option is this?: `grayscale`_

This is a `pixelate` option. It converts the image to grayscale when set to `true`. Defaults to `false`.

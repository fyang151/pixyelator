function convertToImageElement(image) {
  switch (true) {
    case image instanceof HTMLImageElement:
      return image;
    case image instanceof Blob:
      return blobToImageElement(image);
    case typeof image === "string" && image.startsWith("data:"):
      return dataURLToImageElement(image);
    case typeof image === "string":
      return imageUrlToImageElement(image);
    case image instanceof ArrayBuffer:
      return arrayBufferToImageElement(image);
    default:
      throw new Error("Unsupported image type");
  }
}

function blobToImageElement(blob) {
  const url = URL.createObjectURL(blob);
  const img = document.createElement("img");
  img.src = url;

  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(img);
    };
  });
}

function dataURLToImageElement(dataUrl) {
  const img = new Image();
  img.src = dataUrl;

  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = (error) => reject(error);
  });
}

function imageUrlToImageElement(imageUrl) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = imageUrl;

  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(img);
  });
}

function arrayBufferToImageElement(arrayBuffer) {
  const blob = new Blob([arrayBuffer], { type: "image/png" });
  return blobToImageElement(blob);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Canvas to Blob conversion failed"));
      }
    }, "image/png");
  });
}

function canvasToDataURL(canvas) {
  return canvas.toDataURL("image/png");
}

function canvasToArrayBuffer(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob.arrayBuffer());
      } else {
        reject(new Error("Canvas to Blob conversion failed"));
      }
    });
  });
}

export class Pixyelator {
  constructor(imageElement, options = {}) {
    this._imageElement = imageElement;
    this._width = imageElement.naturalWidth;
    this._height = imageElement.naturalHeight;
    this._canvas = options.targetCanvas || document.createElement("canvas");
    this._isDisposed = false;
  }

  static async fromImage(imageSource, options = {}) {
    const imageElement = await convertToImageElement(imageSource);

    if (!imageElement) {
      throw new Error("Failed to load image");
    }

    if (imageElement.naturalWidth === 0 || imageElement.naturalHeight === 0) {
      throw new Error("Invalid image dimensions");
    }

    return new Pixyelator(imageElement, options);
  }

  /**
   * Pixelate the image and write to the target canvas
   * @param {number} xPixels - Number of horizontal pixels/blocks
   * @param {number} yPixels - Number of vertical pixels/blocks
   * @param {Object} [options={}] - Pixelation options
   * @param {boolean} [options.grayscale] - Whether to convert the image to grayscale
   * @returns {Promise & ChainableMethods} Promise with chainable output methods
   */
  pixelate(xPixels, yPixels, options = {}) {
    if (this._isDisposed) {
      throw new Error("Cannot operate on disposed Pixyelator instance");
    }

    if (
      !Number.isInteger(xPixels) ||
      !Number.isInteger(yPixels) ||
      xPixels <= 0 ||
      yPixels <= 0
    ) {
      throw new Error("Pixel dimensions must be positive integers");
    }

    if (xPixels > this._width || yPixels > this._height) {
      throw new Error("Pixel dimensions cannot exceed image dimensions");
    }

    const pixelatePromise = this._pixelateElementToCanvas(
      xPixels,
      yPixels,
      options
    );

    const chainable = Object.assign(pixelatePromise, {
      toBlob: async () => {
        await pixelatePromise;
        return this.toBlob();
      },

      toCanvas: async () => {
        await pixelatePromise;
        return this.toCanvas();
      },

      toDataURL: async () => {
        await pixelatePromise;
        return this.toDataURL();
      },

      toArrayBuffer: async () => {
        await pixelatePromise;
        return this.toArrayBuffer();
      },
    });

    return chainable;
  }

  async _pixelateElementToCanvas(xPixels, yPixels, options = {}) {
    const canvas = this._canvas;
    canvas.width = this._width;
    canvas.height = this._height;
    const ctx = canvas.getContext("2d");
    const grayscale = options.grayscale || false;

    const imageBitmap = await createImageBitmap(this._imageElement);

    const tinyBitmap = await new Promise((resolve, reject) => {
      const worker = new Worker(new URL("rgbaWorker.js", import.meta.url));

      worker.onmessage = (e) => {
        worker.terminate();
        if (e.data.success) {
          resolve(e.data.bitmap);
        } else {
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      worker.postMessage(
        [imageBitmap, xPixels, yPixels, grayscale],
        [imageBitmap]
      );
    });

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tinyBitmap, 0, 0, this._width, this._height);
    tinyBitmap.close();
  }

  /**
   * Get the canvas element containing the pixelated image
   * @returns {HTMLCanvasElement} The canvas element
   */
  toCanvas() {
    if (this._isDisposed) {
      throw new Error("Cannot operate on disposed Pixyelator instance");
    }
    return this._canvas;
  }

  /**
   * Convert the pixelated image to a Blob
   * @returns {Promise<Blob>} Promise resolving to a Blob containing the image data
   */
  async toBlob() {
    if (this._isDisposed) {
      throw new Error("Cannot operate on disposed Pixyelator instance");
    }
    return canvasToBlob(this._canvas);
  }

  /**
   * Convert the pixelated image to a data URL
   * @returns {string} Data URL string containing the image data
   */
  toDataURL() {
    if (this._isDisposed) {
      throw new Error("Cannot operate on disposed Pixyelator instance");
    }
    return canvasToDataURL(this._canvas);
  }

  /**
   * Convert the pixelated image to an ArrayBuffer
   * @returns {Promise<ArrayBuffer>} Promise resolving to an ArrayBuffer containing the image data
   */
  async toArrayBuffer() {
    if (this._isDisposed) {
      throw new Error("Cannot operate on disposed Pixyelator instance");
    }
    return canvasToArrayBuffer(this._canvas);
  }

  /**
   * Clean up resources and dispose of the instance
   */
  dispose() {
    if (this._isDisposed) return;

    this._imageElement = null;
    this._canvas = null;

    this._isDisposed = true;
  }
}

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
    this._maxWorkers = options.maxWorkers || navigator.hardwareConcurrency || 4;
    this._canvas = options.targetCanvas || document.createElement("canvas");
    this._isDisposed = false;
  }
  /**
   * Factory method to create Pixyelator instance from various image sources
   * @param {string|Blob|ArrayBuffer|HTMLImageElement} imageSource - Image source
   * @param {Object} [options={}] - Configuration options
   * @param {number} [options.maxWorkers] - Maximum number of web workers to use (defaults to navigator.hardwareConcurrency or 4)
   * @param {HTMLCanvasElement} [options.targetCanvas] - Canvas to write pixelation results to
   * @returns {Promise<Pixyelator>} New Pixyelator instance
   */
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
    const element = this._imageElement;
    const width = this._width;
    const height = this._height;
    const maxWorkers = this._maxWorkers;
    const grayscale = options.grayscale || false;

    return new Promise((resolve) => {
      const canvas = this._canvas;
      const ctx = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      const shouldAllocateByRows = xPixels > yPixels;

      const widthRemainderPixels = width % xPixels;
      const heightRemainderPixels = height % yPixels;

      let individualSectionWidths = Array.from({ length: xPixels }, () =>
        Math.floor(width / xPixels)
      );

      for (let i = 0; i < widthRemainderPixels; i++) {
        individualSectionWidths[
          Math.floor(i * (xPixels / widthRemainderPixels))
        ]++;
      }

      let individualSectionHeights = Array.from({ length: yPixels }, () =>
        Math.floor(height / yPixels)
      );

      for (let i = 0; i < heightRemainderPixels; i++) {
        individualSectionHeights[
          Math.floor(i * (yPixels / heightRemainderPixels))
        ]++;
      }

      const workerArray = [];

      const tasks = [];
      let resolvedTasks = 0;

      const outerValues = shouldAllocateByRows
        ? individualSectionHeights
        : individualSectionWidths;

      const innerValues = shouldAllocateByRows
        ? individualSectionWidths
        : individualSectionHeights;

      let outerDimension = 0;

      outerValues.forEach((outerValue) => {
        tasks.push([outerValue, outerDimension]);
        outerDimension += outerValue;
      });

      const maxProcesses = Math.min(tasks.length, maxWorkers);

      for (let i = 0; i < maxProcesses; i++) {
        nextQueue();
      }

      function processInnerSlice(
        outerValue,
        outerDimension,
        innerWorker = null
      ) {
        const [sliceX, sliceY, sliceWidth, sliceHeight] = shouldAllocateByRows
          ? [0, outerDimension, width, outerValue]
          : [outerDimension, 0, outerValue, height];
        return new Promise((resolve, reject) => {
          createImageBitmap(
            element,
            sliceX,
            sliceY,
            sliceWidth,
            sliceHeight
          ).then((imageSliceBitmap) => {
            if (!innerWorker) {
              innerWorker = new Worker(
                new URL("innerWorker.js", import.meta.url)
              );
              workerArray.push(innerWorker);
            }

            innerWorker.postMessage([
              imageSliceBitmap,
              width,
              height,
              outerValue,
              grayscale,
              innerValues,
              shouldAllocateByRows,
            ]);

            innerWorker.onmessage = (e) => {
              resolve(e.data);
              nextQueue(innerWorker);
            };
            innerWorker.onerror = (err) => {
              reject(err);
              nextQueue(innerWorker);
            };
          });
        });
      }

      function nextQueue(innerWorker = null) {
        if (tasks.length > 0) {
          const [outerValue, outerDimension] = tasks.shift();

          return processInnerSlice(
            outerValue,
            outerDimension,
            innerWorker
          ).then((result) => {
            const [x, y] = shouldAllocateByRows
              ? [0, outerDimension]
              : [outerDimension, 0];

            ctx.drawImage(result, x, y);
            resolvedTasks++;
            if (resolvedTasks === outerValues.length) {
              workerArray.forEach((worker) => worker.terminate());
              resolve();
            }
          });
        }
      }
    });
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

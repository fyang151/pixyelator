import { test, expect } from "@playwright/test";

/**
 * Pixyelator End-to-End Test Suite
 *
 * Tests the future OOP Pixyelator API implementation
 * NOTE: These tests will fail until the new API is implemented
 */

// Use TEST_DIST=true to test the built dist version
const distParam = process.env.TEST_DIST === "true" ? "?dist=true" : "";

test.describe("Pixyelator OOP API", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page and wait for Pixyelator to load
    await page.goto(`/tests/fixtures/test-page.html${distParam}`);

    // Wait for the page to load and Pixyelator to be available
    await page.waitForLoadState("networkidle");

    // Add our helper functions to the page context
    await page.addInitScript(() => {
      // Make helper functions available in browser context
      window.testHelpers = {};
    });
  });

  test.describe("Factory Pattern Tests", () => {
    test("should create Pixyelator instance from valid image", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );
          return {
            success: true,
            hasPixelateMethod: typeof pixyelator.pixelate === "function",
            hasToCanvasMethod: typeof pixyelator.toCanvas === "function",
            hasToBlobMethod: typeof pixyelator.toBlob === "function",
            hasDisposeMethod: typeof pixyelator.dispose === "function",
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasPixelateMethod).toBe(true);
      expect(result.hasToCanvasMethod).toBe(true);
      expect(result.hasToBlobMethod).toBe(true);
      expect(result.hasDisposeMethod).toBe(true);
    });

    test("should accept constructor options", async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const options = { customCanvasId: "test-canvas" };
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png",
            options
          );
          return { success: true, instance: !!pixyelator };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.instance).toBe(true);
    });

    test("should reject Promise for invalid image path", async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          await window.Pixyelator.fromImage("/nonexistent/image.png");
          return { success: true }; // Should not reach here
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(false);
    });
  });

  test.describe("Instance Method Tests", () => {
    let pixyelator;

    test.beforeEach(async ({ page }) => {
      // Create a Pixyelator instance for each test
      await page.evaluate(async () => {
        window.testPixyelator = await window.Pixyelator.fromImage(
          "/tests/fixtures/images/frutiger/input/frutiger.png"
        );
      });
    });

    test("should work on original image, not cumulative", async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // First pixelation
          await window.testPixyelator.pixelate(8, 8);
          const canvas1 = await window.testPixyelator.toCanvas();
          const imageData1 = canvas1
            .getContext("2d")
            .getImageData(0, 0, canvas1.width, canvas1.height);

          // Second pixelation with same parameters should produce identical result
          await window.testPixyelator.pixelate(8, 8);
          const canvas2 = await window.testPixyelator.toCanvas();
          const imageData2 = canvas2
            .getContext("2d")
            .getImageData(0, 0, canvas2.width, canvas2.height);

          // Compare pixel data
          let identical = true;
          for (let i = 0; i < imageData1.data.length; i++) {
            if (imageData1.data[i] !== imageData2.data[i]) {
              identical = false;
              break;
            }
          }

          return { success: true, identical };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.identical).toBe(true);
    });
  });

  test.describe("Method Chaining Tests", () => {
    test("should support method chaining pixelate().toBlob()", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );
          const blob = await pixyelator.pixelate(4, 4).toBlob();
          return {
            success: true,
            isBlob: blob instanceof Blob,
            type: blob.type,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.isBlob).toBe(true);
      expect(result.type).toBe("image/png");
    });

    test("should support chaining with multiple operations", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );

          // Chain multiple operations
          await pixyelator.pixelate(8, 8);
          const canvas = await pixyelator.toCanvas();
          const blob = await pixyelator.toBlob();

          return {
            success: true,
            hasCanvas: canvas instanceof HTMLCanvasElement,
            hasBlob: blob instanceof Blob,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasCanvas).toBe(true);
      expect(result.hasBlob).toBe(true);
    });
  });

  test.describe("Resource Management Tests", () => {
    test("should dispose resources properly", async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );
          await pixyelator.pixelate(8, 8);

          // Dispose should not throw
          pixyelator.dispose();

          return { success: true };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
    });

    test("should throw errors when using disposed instance", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );
          pixyelator.dispose();

          // These should throw errors
          try {
            await pixyelator.pixelate(8, 8);
            return {
              success: false,
              error: "Should have thrown error for disposed instance",
            };
          } catch (disposedError) {
            return {
              success: true,
              threwError: true,
              errorMessage: disposedError.message,
            };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.threwError).toBe(true);
      expect(result.errorMessage).toContain("disposed"); // Should mention disposal
    });
  });

  test.describe("Pixel-Perfect Validation Tests", () => {
    // Add helper function to page context for image comparison
    test.beforeEach(async ({ page }) => {
      // Inject the helper functions from image-comparison.js into the browser context
      // NOTE: addInitScript must be called BEFORE page.goto()
      await page.addInitScript(() => {
        // Load an image file into a canvas element
        window.loadImageToCanvas = async function (imagePath) {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = () => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");

              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              ctx.drawImage(img, 0, 0);

              resolve(canvas);
            };

            img.onerror = () => {
              reject(new Error(`Failed to load image: ${imagePath}`));
            };

            img.src = imagePath;
          });
        };

        // Extract pixel data from canvas
        window.getImageData = function (canvas) {
          const ctx = canvas.getContext("2d");
          return ctx.getImageData(0, 0, canvas.width, canvas.height);
        };

        // Compare two ImageData arrays pixel by pixel
        window.comparePixelData = function (actualData, expectedData) {
          // Check dimensions first
          if (
            actualData.width !== expectedData.width ||
            actualData.height !== expectedData.height
          ) {
            return {
              match: false,
              error: `Dimension mismatch: actual ${actualData.width}x${actualData.height}, expected ${expectedData.width}x${expectedData.height}`,
            };
          }

          const actual = actualData.data;
          const expected = expectedData.data;

          if (actual.length !== expected.length) {
            return {
              match: false,
              error: `Data length mismatch: actual ${actual.length}, expected ${expected.length}`,
            };
          }

          let differentPixels = 0;
          const differences = [];

          // Compare every RGBA value
          for (let i = 0; i < actual.length; i += 4) {
            const pixelIndex = i / 4;
            const x = pixelIndex % actualData.width;
            const y = Math.floor(pixelIndex / actualData.width);

            const actualR = actual[i];
            const actualG = actual[i + 1];
            const actualB = actual[i + 2];
            const actualA = actual[i + 3];

            const expectedR = expected[i];
            const expectedG = expected[i + 1];
            const expectedB = expected[i + 2];
            const expectedA = expected[i + 3];

            if (
              actualR !== expectedR ||
              actualG !== expectedG ||
              actualB !== expectedB ||
              actualA !== expectedA
            ) {
              differentPixels++;

              // Store first 10 differences for debugging
              if (differences.length < 10) {
                differences.push({
                  position: { x, y },
                  actual: { r: actualR, g: actualG, b: actualB, a: actualA },
                  expected: {
                    r: expectedR,
                    g: expectedG,
                    b: expectedB,
                    a: expectedA,
                  },
                });
              }
            }
          }

          const totalPixels = actual.length / 4;
          const match = differentPixels === 0;

          return {
            match,
            differentPixels,
            totalPixels,
            accuracy:
              (((totalPixels - differentPixels) / totalPixels) * 100).toFixed(
                2
              ) + "%",
            differences: differences.length > 0 ? differences : undefined,
          };
        };

        // Calculate how many pixels differ between two canvases
        window.pixelDifference = function (actualCanvas, expectedCanvas) {
          const actualData = window.getImageData(actualCanvas);
          const expectedData = window.getImageData(expectedCanvas);
          return window.comparePixelData(actualData, expectedData);
        };

        // Alias for backwards compatibility with existing tests
        window.compareCanvases = window.pixelDifference;

        // Create a visual diff canvas showing differences between two images
        window.createDiffCanvas = function (actualCanvas, expectedCanvas) {
          const diffCanvas = document.createElement("canvas");
          const diffCtx = diffCanvas.getContext("2d");

          diffCanvas.width = actualCanvas.width;
          diffCanvas.height = actualCanvas.height;

          const actualData = window.getImageData(actualCanvas);
          const expectedData = window.getImageData(expectedCanvas);
          const diffImageData = diffCtx.createImageData(
            diffCanvas.width,
            diffCanvas.height
          );

          const actual = actualData.data;
          const expected = expectedData.data;
          const diff = diffImageData.data;

          for (let i = 0; i < actual.length; i += 4) {
            const isDifferent =
              actual[i] !== expected[i] ||
              actual[i + 1] !== expected[i + 1] ||
              actual[i + 2] !== expected[i + 2] ||
              actual[i + 3] !== expected[i + 3];

            if (isDifferent) {
              // Highlight differences in red
              diff[i] = 255; // R
              diff[i + 1] = 0; // G
              diff[i + 2] = 0; // B
              diff[i + 3] = 255; // A
            } else {
              // Keep original pixel
              diff[i] = actual[i];
              diff[i + 1] = actual[i + 1];
              diff[i + 2] = actual[i + 2];
              diff[i + 3] = actual[i + 3];
            }
          }

          diffCtx.putImageData(diffImageData, 0, 0);
          return diffCanvas;
        };

        // Load binary files (blob, arraybuffer) from the server
        window.loadBinaryFile = async function (filePath) {
          const response = await fetch(filePath);
          const arrayBuffer = await response.arrayBuffer();
          return Array.from(new Uint8Array(arrayBuffer));
        };

        // Load text files (dataurl) from the server
        window.loadTextFile = async function (filePath) {
          const response = await fetch(filePath);
          return await response.text();
        };

        // Compare binary data byte-by-byte
        window.compareBinary = function (actual, expected) {
          if (actual.length !== expected.length) {
            return {
              match: false,
              error: `Length mismatch: ${actual.length} vs ${expected.length}`,
            };
          }
          let differences = 0;
          const diffPositions = [];
          for (let i = 0; i < actual.length; i++) {
            if (actual[i] !== expected[i]) {
              differences++;
              if (diffPositions.length < 10) {
                diffPositions.push({
                  position: i,
                  actual: actual[i],
                  expected: expected[i],
                });
              }
            }
          }
          return {
            match: differences === 0,
            differences,
            totalBytes: actual.length,
            diffPositions: diffPositions.length > 0 ? diffPositions : undefined,
          };
        };

        // Convert a Blob to a canvas (for testing blob exports)
        window.blobToCanvas = async function (blob) {
          return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);

            img.onload = () => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              ctx.drawImage(img, 0, 0);
              URL.revokeObjectURL(url);
              resolve(canvas);
            };

            img.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error("Failed to load blob as image"));
            };

            img.src = url;
          });
        };

        // Convert an ArrayBuffer to a canvas (for testing arraybuffer exports)
        window.arrayBufferToCanvas = async function (arrayBuffer) {
          const blob = new Blob([arrayBuffer], { type: "image/png" });
          return window.blobToCanvas(blob);
        };

        // Convert a data URL to a canvas (for testing dataURL exports)
        window.dataURLToCanvas = async function (dataURL) {
          return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              ctx.drawImage(img, 0, 0);
              resolve(canvas);
            };

            img.onerror = () => {
              reject(new Error("Failed to load data URL as image"));
            };

            img.src = dataURL;
          });
        };
      });

      // Navigate to the test page AFTER adding init scripts
      await page.goto(`/tests/fixtures/test-page.html${distParam}`);
      await page.waitForLoadState("networkidle");
    });

    test("should match expected 4x4 grayscale pixelation", async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );
          await pixyelator.pixelate(4, 4, { grayscale: true });
          const actualCanvas = await pixyelator.toCanvas();

          const expectedCanvas = await window.loadImageToCanvas(
            "/tests/fixtures/images/frutiger/expected/4x4-grayscale.png"
          );
          const comparison = window.compareCanvases(
            actualCanvas,
            expectedCanvas
          );

          return {
            success: true,
            ...comparison,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.match).toBe(true);
      if (!result.match) {
        console.log(
          `Pixel accuracy: ${result.accuracy}, Differences: ${result.differences}/${result.totalPixels}`
        );
      }
    });

    test("should match expected 4x4 colour pixelation", async ({ page }) => {
      // Capture browser console logs
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );
          await pixyelator.pixelate(4, 4, { grayscale: false });
          const actualCanvas = await pixyelator.toCanvas();

          const expectedCanvas = await window.loadImageToCanvas(
            "/tests/fixtures/images/frutiger/expected/4x4-colour.png"
          );
          const comparison = window.compareCanvases(
            actualCanvas,
            expectedCanvas
          );

          return {
            success: true,
            ...comparison,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.match).toBe(true);
    });

    test("should match expected 32x32 colour pixelation", async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );
          await pixyelator.pixelate(32, 32, { grayscale: false });
          const actualCanvas = await pixyelator.toCanvas();

          const expectedCanvas = await window.loadImageToCanvas(
            "/tests/fixtures/images/frutiger/expected/32x32-colour.png"
          );
          const comparison = window.compareCanvases(
            actualCanvas,
            expectedCanvas
          );

          return {
            success: true,
            ...comparison,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.match).toBe(true);
    });

    test("should match expected 100x100 colour pixelation", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );
          await pixyelator.pixelate(100, 100, { grayscale: false });
          const actualCanvas = await pixyelator.toCanvas();

          const expectedCanvas = await window.loadImageToCanvas(
            "/tests/fixtures/images/frutiger/expected/100x100-colour.png"
          );
          const comparison = window.compareCanvases(
            actualCanvas,
            expectedCanvas
          );

          return {
            success: true,
            ...comparison,
          };
        } catch (error) {
          return { success: false, error: error.message };
        }
      });

      expect(result.success).toBe(true);
      expect(result.match).toBe(true);
    });

    test.describe("Output Format Tests", () => {
      // Tests for blob format
      test("should match expected 4x4-colour.blob", async ({ page }) => {
        const result = await page.evaluate(async () => {
          try {
            const pixyelator = await window.Pixyelator.fromImage(
              "/tests/fixtures/images/frutiger/input/frutiger.png"
            );
            await pixyelator.pixelate(4, 4, { grayscale: false });
            const actualBlob = await pixyelator.toBlob();

            // Convert blob back to canvas and compare pixels
            const actualCanvas = await window.blobToCanvas(actualBlob);
            const expectedCanvas = await window.loadImageToCanvas(
              "/tests/fixtures/images/frutiger/expected/4x4-colour.png"
            );

            const comparison = window.compareCanvases(
              actualCanvas,
              expectedCanvas
            );

            return {
              success: true,
              ...comparison,
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        expect(result.success).toBe(true);
        expect(result.match).toBe(true);
      });

      // Tests for arraybuffer format
      test("should match expected 4x4-colour.arraybuffer.bin", async ({
        page,
      }) => {
        const result = await page.evaluate(async () => {
          try {
            const pixyelator = await window.Pixyelator.fromImage(
              "/tests/fixtures/images/frutiger/input/frutiger.png"
            );
            await pixyelator.pixelate(4, 4, { grayscale: false });
            const actualArrayBuffer = await pixyelator.toArrayBuffer();

            // Convert arraybuffer back to canvas and compare pixels
            const actualCanvas = await window.arrayBufferToCanvas(
              actualArrayBuffer
            );
            const expectedCanvas = await window.loadImageToCanvas(
              "/tests/fixtures/images/frutiger/expected/4x4-colour.png"
            );

            const comparison = window.compareCanvases(
              actualCanvas,
              expectedCanvas
            );

            return {
              success: true,
              ...comparison,
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        expect(result.success).toBe(true);
        expect(result.match).toBe(true);
      });

      // Tests for dataurl format
      test("should match expected 4x4-colour.dataurl.txt", async ({ page }) => {
        const result = await page.evaluate(async () => {
          try {
            const pixyelator = await window.Pixyelator.fromImage(
              "/tests/fixtures/images/frutiger/input/frutiger.png"
            );
            await pixyelator.pixelate(4, 4, { grayscale: false });
            const actualDataURL = pixyelator.toDataURL();

            // Convert dataURL back to canvas and compare pixels
            const actualCanvas = await window.dataURLToCanvas(actualDataURL);
            const expectedCanvas = await window.loadImageToCanvas(
              "/tests/fixtures/images/frutiger/expected/4x4-colour.png"
            );

            const comparison = window.compareCanvases(
              actualCanvas,
              expectedCanvas
            );

            return {
              success: true,
              ...comparison,
            };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });

        expect(result.success).toBe(true);
        expect(result.match).toBe(true);
      });
    });
  });

  test.describe("Error Handling Tests", () => {
    test("should handle invalid pixel dimensions", async ({ page }) => {
      const result = await page.evaluate(async () => {
        const pixyelator = await window.Pixyelator.fromImage(
          "/tests/fixtures/images/frutiger/input/frutiger.png"
        );
        const errors = [];

        // Test negative values
        try {
          await pixyelator.pixelate(-1, 8);
        } catch (error) {
          errors.push("negative-x");
        }

        try {
          await pixyelator.pixelate(8, -1);
        } catch (error) {
          errors.push("negative-y");
        }

        // Test zero values
        try {
          await pixyelator.pixelate(0, 8);
        } catch (error) {
          errors.push("zero-x");
        }

        try {
          await pixyelator.pixelate(8, 0);
        } catch (error) {
          errors.push("zero-y");
        }

        return { success: true, errors };
      });

      expect(result.success).toBe(true);
      expect(result.errors).toContain("negative-x");
      expect(result.errors).toContain("negative-y");
      expect(result.errors).toContain("zero-x");
      expect(result.errors).toContain("zero-y");
    });

    test("should handle pixel dimensions larger than image", async ({
      page,
    }) => {
      const result = await page.evaluate(async () => {
        try {
          const pixyelator = await window.Pixyelator.fromImage(
            "/tests/fixtures/images/frutiger/input/frutiger.png"
          );

          // Try to pixelate with more pixels than the image has
          await pixyelator.pixelate(10000, 10000);

          return {
            success: false,
            error: "Should have thrown error for oversized dimensions",
          };
        } catch (error) {
          return {
            success: true,
            threwError: true,
            errorMessage: error.message,
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.threwError).toBe(true);
      expect(result.errorMessage).toMatch(/dimension|size|exceed/i);
    });
  });
});

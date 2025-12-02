onmessage = (e) => {
  const [imageBitmap, xPixels, yPixels, grayscale = false] = e.data;

  try {
    const sourceCanvas = new OffscreenCanvas(
      imageBitmap.width,
      imageBitmap.height
    );
    const sourceCtx = sourceCanvas.getContext("2d", {
      willReadFrequently: true,
    });
    sourceCtx.drawImage(imageBitmap, 0, 0);

    const tinyCanvas = new OffscreenCanvas(xPixels, yPixels);
    const tinyCtx = tinyCanvas.getContext("2d");

    const blockWidth = imageBitmap.width / xPixels;
    const blockHeight = imageBitmap.height / yPixels;

    for (let by = 0; by < yPixels; by++) {
      for (let bx = 0; bx < xPixels; bx++) {
        const x = Math.floor(bx * blockWidth);
        const y = Math.floor(by * blockHeight);
        const w = Math.floor((bx + 1) * blockWidth) - x;
        const h = Math.floor((by + 1) * blockHeight) - y;

        const imageData = sourceCtx.getImageData(x, y, w, h);
        const data = imageData.data;
        const pixelCount = data.length / 4;

        let r = 0,
          g = 0,
          b = 0,
          a = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          a += data[i + 3];
        }

        r = Math.floor(r / pixelCount);
        g = Math.floor(g / pixelCount);
        b = Math.floor(b / pixelCount);
        a = Math.floor(a / pixelCount) / 255;

        if (grayscale) {
          // Standard luminance formula (ITU-R BT.709)
          const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
          r = g = b = gray;
        }

        tinyCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        tinyCtx.fillRect(bx, by, 1, 1);
      }
    }

    const bitmap = tinyCanvas.transferToImageBitmap();
    self.postMessage({ success: true, bitmap }, [bitmap]);
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};

// Background Timer Web Worker via Blob
export function createBackgroundWorker(onTick: () => void): () => void {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    const fallbackId = window.setInterval(onTick, 500);
    return () => clearInterval(fallbackId);
  }

  try {
    const blobCode = `
      let timer = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (!timer) {
            timer = setInterval(function() {
              self.postMessage('tick');
            }, 250);
          }
        } else if (e.data === 'stop') {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
        }
      };
    `;

    const blob = new Blob([blobCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    worker.onmessage = (e) => {
      if (e.data === 'tick') {
        onTick();
      }
    };

    worker.postMessage('start');

    return () => {
      worker.postMessage('stop');
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };
  } catch (err) {
    console.warn('Web Worker fallback to setInterval:', err);
    const fallbackId = window.setInterval(onTick, 250);
    return () => clearInterval(fallbackId);
  }
}

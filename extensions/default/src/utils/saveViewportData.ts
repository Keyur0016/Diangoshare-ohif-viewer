import { utils } from '@ohif/core';
import { getEnabledElement } from '@cornerstonejs/core';

const { downloadUrl } = utils;

/**
 * Convert canvas to Blob using toBlob() — more reliable than toDataURL → fetch
 */
function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('canvas.toBlob() returned null'));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Capture viewport image as Blob
 */
export async function getViewportImageAsBlob(
  servicesManager: AppTypes.ServicesManager,
  viewportId?: string
): Promise<Blob | null> {
  const { viewportGridService, cornerstoneViewportService } = servicesManager.services;

  const activeViewportId = viewportId || viewportGridService.getActiveViewportId();
  if (!activeViewportId) return null;

  const viewportElement = document.querySelector(
    `div[data-viewportid="${activeViewportId}"]`
  ) as HTMLDivElement;

  if (!viewportElement) return null;

  const enabledElement = getEnabledElement(viewportElement);
  if (!enabledElement) return null;

  const viewport = cornerstoneViewportService.getCornerstoneViewport(activeViewportId);
  if (!viewport) return null;

  const renderingEngine = cornerstoneViewportService.getRenderingEngine();
  if (renderingEngine) {
    renderingEngine.renderViewport(activeViewportId);
    // Give render a tick to complete before capturing
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const canvases = viewportElement.querySelectorAll('canvas');
  if (canvases.length === 0) return null;

  let mainCanvas: HTMLCanvasElement | null = null;
  let maxArea = 0;

  canvases.forEach((canvas: HTMLCanvasElement) => {
    const area = canvas.width * canvas.height;
    if (area > maxArea) {
      maxArea = area;
      mainCanvas = canvas;
    }
  });

  if (!mainCanvas) return null;

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = (mainCanvas as HTMLCanvasElement).width;
  outputCanvas.height = (mainCanvas as HTMLCanvasElement).height;

  const ctx = outputCanvas.getContext('2d');
  if (!ctx) return null;

  // Draw main canvas first, then overlay smaller canvases
  ctx.drawImage(mainCanvas as HTMLCanvasElement, 0, 0);

  canvases.forEach((canvas: HTMLCanvasElement) => {
    if (canvas !== mainCanvas && canvas.width > 0 && canvas.height > 0) {
      ctx.drawImage(canvas, 0, 0);
    }
  });

  // ✅ Use toBlob() directly — avoids fetch(dataURL) unreliability
  try {
    const blob = await canvasToBlob(outputCanvas, 'image/png');
    return blob;
  } catch (err) {
    console.error('canvasToBlob failed:', err);
    return null;
  }
}

/**
 * Save viewport image locally
 */
export async function saveViewportData(
  servicesManager: AppTypes.ServicesManager,
  viewportId?: string
): Promise<void> {
  const { viewportGridService } = servicesManager.services;

  const activeViewportId = viewportId || viewportGridService.getActiveViewportId();
  if (!activeViewportId) {
    console.warn('No active viewport found');
    return;
  }

  const blob = await getViewportImageAsBlob(servicesManager, viewportId);

  if (!blob) {
    console.warn('Could not capture viewport image');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `viewport-save-${timestamp}.png`;

  downloadUrl(URL.createObjectURL(blob), { filename });
}

/**
 * Attach viewport image to report API
 */
export async function attachViewportImageToReport(
  servicesManager: AppTypes.ServicesManager,
  viewportId?: string
): Promise<void> {

  const reportToken =
    typeof window !== 'undefined' && window.sessionStorage
      ? window.sessionStorage.getItem('reporttoken')
      : null;

  if (!reportToken) {
    throw new Error('Report token not found');
  }

  const blob = await getViewportImageAsBlob(servicesManager, viewportId);

  if (!blob) {
    throw new Error('Could not capture viewport image');
  }

  const config =
    typeof window !== 'undefined'
      ? (window as any).config
      : undefined;

  const baseUrl = config?.attachImageApiBaseUrl;
  const url = `${String(baseUrl).replace(/\/$/, '')}/api/attach-image/`;

  const getAuthHeader = config?.getAuthorizationHeader;
  const authHeader = getAuthHeader ? getAuthHeader() : {};
  const authorization = authHeader?.Authorization ?? authHeader?.authorization;

  /**
   * Convert Blob -> Base64
   */
  const base64Image: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result); // includes data:image/png;base64,...
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const payload = {
    report_token: reportToken,
    image: base64Image
  };

  console.log("JSON Payload:", payload);

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (authorization) {
    headers["Authorization"] = authorization;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP ${res.status}`);
  }

  console.log("Image attached successfully");
}

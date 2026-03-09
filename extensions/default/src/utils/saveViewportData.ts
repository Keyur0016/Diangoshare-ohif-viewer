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
 * Draw an SVG element onto a 2D canvas context (e.g. annotation/measurement layer).
 */
function drawSvgOnCanvas(
  ctx: CanvasRenderingContext2D,
  svg: SVGElement,
  width: number,
  height: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    const serializer = new XMLSerializer();
    const str = serializer.serializeToString(clone);
    const blob = new Blob([str], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG for capture'));
    };
    img.src = url;
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

  // Draw SVG annotation layer (measurements, length tool, etc.) on top
  const svgLayer = viewportElement.querySelector('svg');
  if (svgLayer && outputCanvas.width > 0 && outputCanvas.height > 0) {
    try {
      await drawSvgOnCanvas(ctx, svgLayer, outputCanvas.width, outputCanvas.height);
    } catch (err) {
      console.warn('Could not capture SVG annotation layer:', err);
    }
  }

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
 * Attach viewport image to report API.
 * Uses getViewportImageAsBlob so the image includes the current viewport image,
 * all canvas layers, and the SVG annotation layer (measurements, length tool, etc.).
 * Note: Browser sends a CORS preflight OPTIONS request before this POST (due to
 * Content-Type: application/json and Authorization). The server must respond to
 * OPTIONS with 2xx and CORS headers (Allow: POST, OPTIONS; Access-Control-*)
 * so the browser then sends the actual POST.
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

import { utils } from '@ohif/core';
import { getEnabledElement } from '@cornerstonejs/core';

const { downloadUrl } = utils;

/**
 * Saves the current viewport image exactly as displayed (with zoom, pan, annotations, etc.)
 * @param servicesManager - The services manager instance
 * @param viewportId - Optional viewport ID, if not provided uses active viewport
 */
export async function saveViewportData(
  servicesManager: AppTypes.ServicesManager,
  viewportId?: string
): Promise<void> {
  const { viewportGridService, cornerstoneViewportService } = servicesManager.services;

  // Get the active viewport ID if not provided
  const activeViewportId = viewportId || viewportGridService.getActiveViewportId();

  if (!activeViewportId) {
    console.warn('No active viewport found');
    return;
  }

  try {
    // Get the viewport element from DOM using the viewport ID
    const viewportElement = document.querySelector(
      `div[data-viewportid="${activeViewportId}"]`
    ) as HTMLDivElement;

    if (!viewportElement) {
      console.warn('Viewport element not found in DOM');
      return;
    }

    // Get the enabled element to verify viewport is ready
    const enabledElement = getEnabledElement(viewportElement);
    if (!enabledElement) {
      console.warn('Viewport is not enabled');
      return;
    }

    // Get the cornerstone viewport to ensure it's rendered with current state
    const viewport = cornerstoneViewportService.getCornerstoneViewport(activeViewportId);
    if (!viewport) {
      console.warn('Cornerstone viewport not found');
      return;
    }

    // Force a render to ensure the canvas is up-to-date with current zoom/pan/annotations
    const renderingEngine = cornerstoneViewportService.getRenderingEngine();
    if (renderingEngine) {
      renderingEngine.renderViewport(activeViewportId);
    }

    // Get all canvas elements from the viewport (there might be multiple layers)
    const canvases = viewportElement.querySelectorAll('canvas');

    if (canvases.length === 0) {
      console.warn('No canvas elements found in viewport');
      return;
    }

    // Get the main rendering canvas (usually the first one, or the largest one)
    // The main canvas contains the image with zoom/pan applied
    let mainCanvas: HTMLCanvasElement | null = null;
    let maxArea = 0;

    canvases.forEach(canvas => {
      const area = canvas.width * canvas.height;
      if (area > maxArea) {
        maxArea = area;
        mainCanvas = canvas;
      }
    });

    if (!mainCanvas) {
      console.warn('Main canvas not found');
      return;
    }

    // Create a new canvas to copy the content
    // Use the canvas dimensions to preserve the exact zoom/pan state
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = mainCanvas.width;
    outputCanvas.height = mainCanvas.height;
    const ctx = outputCanvas.getContext('2d', { willReadFrequently: false });

    if (!ctx) {
      console.warn('Could not get canvas context');
      return;
    }

    // Copy the main canvas content (this includes the image with zoom/pan applied)
    ctx.drawImage(mainCanvas, 0, 0);

    // If there are additional canvases (overlays, annotations), composite them
    // Annotations in Cornerstone are typically rendered on the same canvas,
    // but if there are separate overlay canvases, we need to composite them
    canvases.forEach(canvas => {
      if (canvas !== mainCanvas && canvas.width > 0 && canvas.height > 0) {
        // Composite additional layers (like annotations overlays)
        ctx.drawImage(canvas, 0, 0);
      }
    });

    // Also check for SVG overlays that might contain annotations
    const svgOverlays = viewportElement.querySelectorAll('svg');
    if (svgOverlays.length > 0) {
      // Convert SVG to image and composite onto canvas
      for (const svg of Array.from(svgOverlays)) {
        try {
          const svgData = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);

          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, outputCanvas.width, outputCanvas.height);
              URL.revokeObjectURL(url);
              resolve(null);
            };
            img.onerror = reject;
            img.src = url;
          });
        } catch (error) {
          console.warn('Failed to composite SVG overlay:', error);
        }
      }
    }

    // Create timestamp for filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `viewport-save-${timestamp}.png`;

    // Save the image with exact viewport state (zoom, pan, annotations)
    downloadUrl(outputCanvas.toDataURL('image/png', 1.0), { filename });

    console.log('Viewport image saved successfully with current zoom/pan/annotations');
  } catch (error) {
    console.error('Error saving viewport data:', error);
    throw error;
  }
}

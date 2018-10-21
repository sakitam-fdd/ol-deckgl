import { withParameters, setParameters, clear } from 'luma.gl';
import log from '@deck.gl/core/dist/esm/utils/log';
import assert from '@deck.gl/core/dist/esm/utils/assert';

const LOG_PRIORITY_DRAW = 2;

let renderCount = 0;

// TODO - Exported for pick-layers.js - Move to util?
export const getPixelRatio = ({ useDevicePixels }) => {
  assert(typeof useDevicePixels === 'boolean', 'Invalid useDevicePixels');
  return useDevicePixels && typeof window !== 'undefined' ? window.devicePixelRatio : 1;
};

// Convert viewport top-left CSS coordinates to bottom up WebGL coordinates
const getGLViewport = (gl, { viewport, pixelRatio }) => {
  // TODO - dummy default for node
  const height = gl.canvas ? (gl.canvas.clientHeight || gl.canvas.height) : 100;
  // Convert viewport top-left CSS coordinates to bottom up WebGL coordinates
  const dimensions = viewport;
  return [
    dimensions.x * pixelRatio,
    (height - dimensions.y - dimensions.height) * pixelRatio,
    dimensions.width * pixelRatio,
    dimensions.height * pixelRatio
  ];
};

// Helper functions
function clearCanvas (gl) {
  // const pixelRatio = getPixelRatio({useDevicePixels});
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;
  // clear depth and color buffers, restoring transparency
  withParameters(gl, { viewport: [0, 0, width, height] }, () => {
    gl.clear('0x00004000' | '0x00000100');
  });
}

// Draw a list of layers in a list of viewports
export function drawLayers (
  gl,
  {
    layers,
    viewports,
    views,
    onViewportActive,
    useDevicePixels,
    drawPickingColors = false,
    deviceRect = null,
    parameters = {},
    layerFilter = null,
    pass = 'draw',
    redrawReason = '',
    stats,
    customRender
  }
) {
  if (!customRender) {
    clearCanvas(gl, { useDevicePixels });
  }

  // effectManager.preDraw();

  viewports.forEach((viewportOrDescriptor) => {
    const viewport = getViewportFromDescriptor(viewportOrDescriptor);
    const view = views && views[viewport.id];

    // Update context to point to this viewport
    onViewportActive(viewport);

    // render this viewport
    drawLayersInViewport(gl, {
      layers,
      viewport,
      view,
      useDevicePixels,
      drawPickingColors,
      deviceRect,
      parameters,
      layerFilter,
      pass,
      redrawReason,
      stats
    });
  });

  // effectManager.draw();
}

// Draws list of layers and viewports into the picking buffer
// Note: does not sample the buffer, that has to be done by the caller
export function drawPickingBuffer (
  gl,
  {
    layers,
    viewports,
    onViewportActive,
    useDevicePixels,
    pickingFBO,
    deviceRect: { x, y, width, height },
    layerFilter = null,
    redrawReason = ''
  }
) {
  // Make sure we clear scissor test and fbo bindings in case of exceptions
  // We are only interested in one pixel, no need to render anything else
  // Note that the callback here is called synchronously.
  // Set blend mode for picking
  // always overwrite existing pixel with [r,g,b,layerIndex]
  return withParameters(
    gl,
    {
      framebuffer: pickingFBO,
      scissorTest: true,
      scissor: [x, y, width, height],
      clearColor: [0, 0, 0, 0]
    },
    () => {
      drawLayers(gl, {
        layers,
        viewports,
        onViewportActive,
        useDevicePixels,
        drawPickingColors: true,
        layerFilter,
        pass: 'picking',
        redrawReason,
        parameters: {
          blend: true,
          blendFunc: [gl.ONE, gl.ZERO, gl.CONSTANT_ALPHA, gl.ZERO],
          blendEquation: gl.FUNC_ADD,
          blendColor: [0, 0, 0, 0]
        }
      });
    }
  );
}

// Draws a list of layers in one viewport
// TODO - when picking we could completely skip rendering viewports that dont
// intersect with the picking rect
function drawLayersInViewport (
  gl,
  {
    layers,
    viewport,
    view,
    useDevicePixels,
    drawPickingColors = false,
        deviceRect = null, // eslint-disable-line
    parameters = {},
    layerFilter,
    pass = 'draw',
    redrawReason = '',
    stats
  }
) {
  const pixelRatio = getPixelRatio({ useDevicePixels });
  const glViewport = getGLViewport(gl, { viewport, pixelRatio });

  if (view && view.props.clear) {
    const clearOpts = view.props.clear === true ? { color: true, depth: true } : view.props.clear;
    withParameters(
      gl,
      {
        scissorTest: true,
        scissor: glViewport
      },
      () => clear(gl, clearOpts)
    );
  }

  // render layers in normal colors
  const renderStats = {
    totalCount: layers.length,
    visibleCount: 0,
    compositeCount: 0,
    pickableCount: 0
  };

    // const {x, y, width, height} = deviceRect || [];

  setParameters(gl, parameters || {});

  // render layers in normal colors
  layers.forEach((layer, layerIndex) => {
    // Check if we should draw layer
    let shouldDrawLayer = !layer.isComposite && layer.props.visible;
    if (drawPickingColors) {
      shouldDrawLayer = shouldDrawLayer && layer.props.pickable;
    }
    if (shouldDrawLayer && layerFilter) {
      shouldDrawLayer = layerFilter({ layer, viewport, isPicking: drawPickingColors });
    }

    // Calculate stats
    if (shouldDrawLayer && layer.props.pickable) {
      renderStats.pickableCount++;
    }
    if (layer.isComposite) {
      renderStats.compositeCount++;
    }

    // Draw the layer
    if (shouldDrawLayer) {
      renderStats.visibleCount++;

      drawLayerInViewport({
        gl,
        layer,
        layerIndex,
        drawPickingColors,
        pixelRatio,
        glViewport,
        parameters
      });
    }
  });

  renderCount++;

  logRenderStats({ renderStats, pass, redrawReason, stats });
}

function drawLayerInViewport ({
    gl, // eslint-disable-line
  layer,
  layerIndex,
  drawPickingColors,
  pixelRatio,
  glViewport,
  parameters
}) {
  const moduleParameters = Object.assign(Object.create(layer.props), {
    viewport: layer.context.viewport,
    pickingActive: drawPickingColors ? 1 : 0,
    devicePixelRatio: pixelRatio
  });

  const uniforms = Object.assign({}, layer.context.uniforms, { layerIndex });

  // All parameter resolving is done here instead of the layer
  // Blend parameters must not be overriden
  const layerParameters = Object.assign({}, layer.props.parameters || {}, parameters);

  Object.assign(layerParameters, {
    viewport: glViewport
  });

  if (drawPickingColors) {
    Object.assign(layerParameters, {
      blendColor: [0, 0, 0, (layerIndex + 1) / 255]
    });
  } else {
    Object.assign(moduleParameters, getObjectHighlightParameters(layer));
  }

  layer.drawLayer({
    moduleParameters,
    uniforms,
    parameters: layerParameters
  });
}

function logRenderStats ({ renderStats, pass, redrawReason, stats }) {
  if (log.priority >= LOG_PRIORITY_DRAW) {
    const { totalCount, visibleCount, compositeCount, pickableCount } = renderStats;
    const primitiveCount = totalCount - compositeCount;
    const hiddenCount = primitiveCount - visibleCount;

    let message = '';
    message += `RENDER #${renderCount} \
${visibleCount} (of ${totalCount} layers) to ${pass} because ${redrawReason} `;
    if (log.priority > LOG_PRIORITY_DRAW) {
      message += `\
(${hiddenCount} hidden, ${compositeCount} composite ${pickableCount} pickable)`;
    }

    log.log(LOG_PRIORITY_DRAW, message)();

    if (stats) {
      stats.increment('redraw layers', visibleCount);
    }
  }
}

// Get a viewport from a viewport descriptor (which can be a plain viewport)
function getViewportFromDescriptor (viewportOrDescriptor) {
  return viewportOrDescriptor.viewport ? viewportOrDescriptor.viewport : viewportOrDescriptor;
}

/**
 * Returns the picking color of currenlty selected object of the given 'layer'.
 * @return {Array} - the picking color or null if layers selected object is invalid.
 */
function getObjectHighlightParameters (layer) {
  // TODO - inefficient to update settings every render?
  // TODO: Add warning if 'highlightedObjectIndex' is > numberOfInstances of the model.
  const { highlightedObjectIndex, highlightColor } = layer.props;
  const parameters = {
    pickingHighlightColor: highlightColor
  };

    // Update picking module settings if highlightedObjectIndex is set.
    // This will overwrite any settings from auto highlighting.
  if (Number.isInteger(highlightedObjectIndex)) {
    parameters.pickingSelectedColor =
            highlightedObjectIndex >= 0 ? layer.encodePickingColor(highlightedObjectIndex) : null;
  }
  return parameters;
}

import seer from 'seer';
import { Stats } from 'probe.gl';
import assert from '@deck.gl/core/dist/esm/utils/assert';
import { Framebuffer, _ShaderCache as ShaderCache } from 'luma.gl';
import Layer from '@deck.gl/core/dist/esm/lib/layer';
import { pickObject, pickVisibleObjects } from '@deck.gl/core/dist/esm/lib/pick-layers';
import { LIFECYCLE } from '@deck.gl/core/dist/esm/lifecycle/constants';
import log from '@deck.gl/core/dist/esm/utils/log';
import { flatten } from '@deck.gl/core/dist/esm/utils/flatten';
import Viewport from './viewport/viewport';
import { drawLayers } from './draw-layers';

import {
  setPropOverrides,
  layerEditListener,
  seerInitListener,
  initLayerInSeer,
  updateLayerInSeer
} from '@deck.gl/core/dist/esm/lib/seer-integration';

const LOG_PRIORITY_LIFECYCLE = 2;
const LOG_PRIORITY_LIFECYCLE_MINOR = 4;

// CONTEXT IS EXPOSED TO LAYERS
const INITIAL_CONTEXT = Object.seal({
  layerManager: null,
  gl: null,
  useDevicePixels: true, // Exposed in case custom layers need to adjust sizes
  stats: null, // for tracking lifecycle performance
  // Make sure context.viewport is not empty on the first layer initialization
  viewport: new Viewport({ id: 'DEFAULT-INITIAL-VIEWPORT' }), // Current viewport, exposed to layers for project* function
  // GL Resources
  shaderCache: null,
  pickingFBO: null, // Screen-size framebuffer that layers can reuse
  // State
  lastPickedInfo: null,
  animationProps: null,
  userData: {} // Place for any custom app `context`
});

const layerName = layer => (layer instanceof Layer ? `${layer}` : !layer ? 'null' : 'invalid');

export default class LayerManager {
  constructor (gl, { stats } = {}) {
    this.lastRenderedLayers = [];
    this.layers = [];
    this.context = Object.assign({}, INITIAL_CONTEXT, {
      layerManager: this,
      gl,
      // Enabling luma.gl Program caching using private API (_cachePrograms)
      shaderCache: new ShaderCache({ gl, _cachePrograms: true }),
      stats: stats || new Stats({ id: 'deck.gl' }),
      lastPickedInfo: {
        // For callback tracking and autohighlight
        index: -1,
        layerId: null
      }
    });
    this.layerFilter = null;
    this.drawPickingColors = false;
    this._needsRedraw = 'Initial render';
    this._needsUpdate = false;
    this._activateViewport = this._activateViewport.bind(this);
    // Seer integration
    this._initSeer = this._initSeer.bind(this);
    this._editSeer = this._editSeer.bind(this);
    Object.seal(this);
    seerInitListener(this._initSeer);
    layerEditListener(this._editSeer);
  }

  // Method to call when the layer manager is not needed anymore.
  // Currently used in the <DeckGL> componentWillUnmount lifecycle to unbind Seer listeners.
  finalize () {
    seer.removeListener(this._initSeer);
    seer.removeListener(this._editSeer);
  }

  // Check if a redraw is needed
  needsRedraw ({ clearRedrawFlags = true } = {}) {
    return this._checkIfNeedsRedraw(clearRedrawFlags);
  }

  // Check if a deep update of all layers is needed
  needsUpdate () {
    return this._needsUpdate;
  }

  // Layers will be redrawn (in next animation frame)
  setNeedsRedraw (reason) {
    this._needsRedraw = this._needsRedraw || reason;
  }

  // Layers will be updated deeply (in next animation frame)
  // Potentially regenerating attributes and sub layers
  setNeedsUpdate (reason) {
    this._needsUpdate = this._needsUpdate || reason;
  }

  // Gets an (optionally) filtered list of layers
  getLayers ({ layerIds = null } = {}) {
    // Filtering by layerId compares beginning of strings, so that sublayers will be included
    // Dependes on the convention of adding suffixes to the parent's layer name
    return layerIds
      ? this.layers.filter(layer => layerIds.find(layerId => layer.id.indexOf(layerId) === 0))
      : this.layers;
  }

  /**
     * Set props needed for layer rendering and picking.
     * Parameters are to be passed as a single object, with the following values:
     * @param {Boolean} props
     */
  setProps (props) {
    // TODO - For now we set layers before viewports to preserve changeFlags
    if ('layers' in props) {
      this.setLayers(props.layers);
    }
    if ('layerFilter' in props) {
      if (this.layerFilter !== props.layerFilter) {
        this.layerFilter = props.layerFilter;
        this.setNeedsRedraw('layerFilter changed');
      }
    }
    if ('drawPickingColors' in props) {
      if (props.drawPickingColors !== this.drawPickingColors) {
        this.drawPickingColors = props.drawPickingColors;
        this.setNeedsRedraw('drawPickingColors changed');
      }
    }
    // A way for apps to add data to context that can be accessed in layers
    if ('userData' in props) {
      this.context.userData = props.userData;
    }
    if ('useDevicePixels' in props) {
      this.context.useDevicePixels = props.useDevicePixels;
    }
  }

  // Supply a new layer list, initiating sublayer generation and layer matching
  setLayers (newLayers) {
    // TODO - something is generating state updates that cause rerender of the same
    if (newLayers === this.lastRenderedLayers) {
      log.log(3, 'Ignoring layer update due to layer array not changed')();
      return this;
    }
    this.lastRenderedLayers = newLayers;
    newLayers = flatten(newLayers, { filter: Boolean });
    for (const layer of newLayers) {
      layer.context = this.context;
    }
    const { error, generatedLayers } = this._updateLayers({
      oldLayers: this.layers,
      newLayers
    });
    this.layers = generatedLayers;
    // Throw first error found, if any
    if (error) {
      throw error;
    }
    return this;
  }

  // Update layers from last cycle if `setNeedsUpdate()` has been called
  updateLayers () {
    // NOTE: For now, even if only some layer has changed, we update all layers
    // to ensure that layer id maps etc remain consistent even if different
    // sublayers are rendered
    const reason = this.needsUpdate();
    if (reason) {
      this.setNeedsRedraw(`updating layers: ${reason}`);
      // HACK - Call with a copy of lastRenderedLayers to trigger a full update
      this.setLayers([...this.lastRenderedLayers]);
    }
  }

  // Draw all layers in all views
  drawLayers ({
    pass = 'render to screen',
    viewports,
    views,
    redrawReason = 'unknown reason',
    customRender = false
  }) {
    const { drawPickingColors } = this;
    const { gl, useDevicePixels } = this.context;

    // render this viewport
    drawLayers(gl, {
      layers: this.layers,
      viewports,
      views,
      onViewportActive: this._activateViewport,
      useDevicePixels,
      drawPickingColors,
      pass,
      layerFilter: this.layerFilter,
      redrawReason,
      customRender
    });
  }

  // Pick the closest info at given coordinate
  pickObject ({ x, y, mode, radius = 0, layerIds, viewports, depth = 1 }) {
    const { gl, useDevicePixels } = this.context;

    const layers = this.getLayers({ layerIds });

    return pickObject(gl, {
      // User params
      x,
      y,
      radius,
      layers,
      mode,
      layerFilter: this.layerFilter,
      depth,
      // Injected params
      viewports,
      onViewportActive: this._activateViewport,
      pickingFBO: this._getPickingBuffer(),
      lastPickedInfo: this.context.lastPickedInfo,
      useDevicePixels
    });
  }

  // Get all unique infos within a bounding box
  pickObjects ({ x, y, width, height, layerIds, viewports }) {
    const { gl, useDevicePixels } = this.context;

    const layers = this.getLayers({ layerIds });

    return pickVisibleObjects(gl, {
      x,
      y,
      width,
      height,
      layers,
      layerFilter: this.layerFilter,
      mode: 'pickObjects',
      viewports,
      onViewportActive: this._activateViewport,
      pickingFBO: this._getPickingBuffer(),
      useDevicePixels
    });
  }

  //
  // PRIVATE METHODS
  //

  _checkIfNeedsRedraw (clearRedrawFlags) {
    let redraw = this._needsRedraw;
    if (clearRedrawFlags) {
      this._needsRedraw = false;
    }

    // This layers list doesn't include sublayers, relying on composite layers
    for (const layer of this.layers) {
      // Call every layer to clear their flags
      const layerNeedsRedraw = layer.getNeedsRedraw({ clearRedrawFlags });
      redraw = redraw || layerNeedsRedraw;
    }

    return redraw;
  }

  // Make a viewport "current" in layer context, updating viewportChanged flags
  _activateViewport (viewport) {
    const oldViewport = this.context.viewport;
    const viewportChanged = !oldViewport || !viewport.equals(oldViewport);

    if (viewportChanged) {
      log.log(4, 'Viewport changed', viewport)();

      this.context.viewport = viewport;

      // Update layers states
      // Let screen space layers update their state based on viewport
      for (const layer of this.layers) {
        layer.setChangeFlags({ viewportChanged: 'Viewport changed' });
        this._updateLayer(layer);
      }
    }

    assert(this.context.viewport, 'LayerManager: viewport not set');

    return this;
  }

  _getPickingBuffer () {
    const { gl } = this.context;
    // Create a frame buffer if not already available
    this.context.pickingFBO = this.context.pickingFBO || new Framebuffer(gl);
    // Resize it to current canvas size (this is a noop if size hasn't changed)
    this.context.pickingFBO.resize({ width: gl.canvas.width, height: gl.canvas.height });
    return this.context.pickingFBO;
  }

  // Match all layers, checking for caught errors
  // To avoid having an exception in one layer disrupt other layers
  // TODO - mark layers with exceptions as bad and remove from rendering cycle?
  _updateLayers ({ oldLayers, newLayers }) {
    // Create old layer map
    const oldLayerMap = {};
    for (const oldLayer of oldLayers) {
      if (oldLayerMap[oldLayer.id]) {
        log.warn(`Multiple old layers with same id ${layerName(oldLayer)}`)();
      } else {
        oldLayerMap[oldLayer.id] = oldLayer;
      }
    }

    // Allocate array for generated layers
    const generatedLayers = [];

    // Match sublayers
    const error = this._updateSublayersRecursively({
      newLayers,
      oldLayerMap,
      generatedLayers
    });

    // Finalize unmatched layers
    const error2 = this._finalizeOldLayers(oldLayerMap);

    this._needsUpdate = false;

    const firstError = error || error2;
    return { error: firstError, generatedLayers };
  }

  // Note: adds generated layers to `generatedLayers` array parameter
  _updateSublayersRecursively ({ newLayers, oldLayerMap, generatedLayers }) {
    let error = null;

    for (const newLayer of newLayers) {
      newLayer.context = this.context;

      // Given a new coming layer, find its matching old layer (if any)
      const oldLayer = oldLayerMap[newLayer.id];
      if (oldLayer === null) {
        // null, rather than undefined, means this id was originally there
        log.warn(`Multiple new layers with same id ${layerName(newLayer)}`)();
      }
      // Remove the old layer from candidates, as it has been matched with this layer
      oldLayerMap[newLayer.id] = null;

      let sublayers = null;

      // We must not generate exceptions until after layer matching is complete
      try {
        if (!oldLayer) {
          this._initializeLayer(newLayer);
          initLayerInSeer(newLayer); // Initializes layer in seer chrome extension (if connected)
        } else {
          this._transferLayerState(oldLayer, newLayer);
          this._updateLayer(newLayer);
          updateLayerInSeer(newLayer); // Updates layer in seer chrome extension (if connected)
        }
        generatedLayers.push(newLayer);

        // Call layer lifecycle method: render sublayers
        sublayers = newLayer.isComposite && newLayer.getSubLayers();
        // End layer lifecycle method: render sublayers
      } catch (err) {
        log.warn(`error during matching of ${layerName(newLayer)}`, err);
        error = error || err; // Record first exception
      }

      if (sublayers) {
        this._updateSublayersRecursively({
          newLayers: sublayers,
          oldLayerMap,
          generatedLayers
        });
      }
    }

    return error;
  }

  // Finalize any old layers that were not matched
  _finalizeOldLayers (oldLayerMap) {
    let error = null;
    for (const layerId in oldLayerMap) {
      const layer = oldLayerMap[layerId];
      if (layer) {
        error = error || this._finalizeLayer(layer);
      }
    }
    return error;
  }

  // EXCEPTION SAFE LAYER ACCESS

  // Initializes a single layer, calling layer methods
  _initializeLayer (layer) {
    log.log(LOG_PRIORITY_LIFECYCLE, `initializing ${layerName(layer)}`)();

    let error = null;
    try {
      layer._initialize();
      layer.lifecycle = LIFECYCLE.INITIALIZED;
    } catch (err) {
      log.warn(`error while initializing ${layerName(layer)}\n`, err)();
      error = error || err;
      // TODO - what should the lifecycle state be here? LIFECYCLE.INITIALIZATION_FAILED?
    }

    // Set back pointer (used in picking)
    layer.internalState.layer = layer;

    // Save layer on model for picking purposes
    // store on model.userData rather than directly on model
    for (const model of layer.getModels()) {
      model.userData.layer = layer;
    }

    return error;
  }

  _transferLayerState (oldLayer, newLayer) {
    newLayer._transferState(oldLayer);
    newLayer.lifecycle = LIFECYCLE.MATCHED;

    if (newLayer !== oldLayer) {
      log.log(
        LOG_PRIORITY_LIFECYCLE_MINOR,
        `matched ${layerName(newLayer)}`,
        oldLayer,
        '->',
        newLayer
      )();
      oldLayer.lifecycle = LIFECYCLE.AWAITING_GC;
    } else {
      log.log(LOG_PRIORITY_LIFECYCLE_MINOR, `Matching layer is unchanged ${newLayer.id}`)();
    }
  }

  // Updates a single layer, cleaning all flags
  _updateLayer (layer) {
    log.log(
      LOG_PRIORITY_LIFECYCLE_MINOR,
      `updating ${layer} because: ${layer.printChangeFlags()}`
    )();
    let error = null;
    try {
      layer._update();
    } catch (err) {
      log.warn(`error during update of ${layerName(layer)}`, err)();
      // Save first error
      error = err;
    }
    return error;
  }

  // Finalizes a single layer
  _finalizeLayer (layer) {
    assert(layer.lifecycle !== LIFECYCLE.AWAITING_FINALIZATION);
    layer.lifecycle = LIFECYCLE.AWAITING_FINALIZATION;
    let error = null;
    this.setNeedsRedraw(`finalized ${layerName(layer)}`);
    try {
      layer._finalize();
    } catch (err) {
      log.warn(`error during finalization of ${layerName(layer)}`, err)();
      error = err;
    }
    layer.lifecycle = LIFECYCLE.FINALIZED;
    log.log(LOG_PRIORITY_LIFECYCLE, `finalizing ${layerName(layer)}`);
    return error;
  }

  // SEER INTEGRATION

  /**
     * Called upon Seer initialization, manually sends layers data.
     */
  _initSeer () {
    this.layers.forEach(layer => {
      initLayerInSeer(layer);
      updateLayerInSeer(layer);
    });
  }

  /**
     * On Seer property edition, set override and update layers.
     */
  _editSeer (payload) {
    if (payload.type !== 'edit' || payload.valuePath[0] !== 'props') {
      return;
    }

    setPropOverrides(payload.itemKey, payload.valuePath.slice(1), payload.value);
    const newLayers = this.layers.map(layer => new layer.constructor(layer.props));
    this.updateLayers({ newLayers });
  }
}

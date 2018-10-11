import { unByKey } from 'ol/Observable';
import { Object as NObject, Map } from 'ol';
import { transform } from 'ol/proj'
import { getTarget, createCanvas } from './index';
const _options = {
  forcedRerender: false, // Force re-rendering
  forcedPrecomposeRerender: false, // force pre re-render
  hideOnZooming: false, // when zooming hide chart
  hideOnMoving: false, // when moving hide chart
  hideOnRotating: false // // when Rotating hide chart
};

class DeckGl extends NObject {
  constructor (options = {}, map) {
    super();
    /**
     * layer options
     * @type {{}}
     */
    this.$options = Object.assign(_options, options);

    /**
     * map
     * @type {null}
     */
    this.$Map = null;

    if (map) this.appendTo(map);
  }

  /**
   * append layer to map
   * @param map
   */
  appendTo (map) {
    const that = this;
    if (map && map instanceof Map) {
      this.$Map = map;
      this.$Map.once('postrender', (event) => {
        that.render();
      });
      this.$Map.renderSync();
      this._unRegisterEvents();
      this._registerEvents();
    } else {
      throw new Error('not map object');
    }
  }

  /**
   * get map
   * @returns {null}
   */
  getMap () {
    return this.$Map;
  }

  /**
   * is visible
   * @returns {Element|*|boolean}
   * @private
   */
  _isVisible () {
    return this.$container && this.$container.style.display === '';
  }

  /**
   * show layer
   */
  show () {
    if (this.$container) {
      this.$container.style.display = '';
    }
  }

  /**
   * hide layer
   */
  hide () {
    if (this.$container) {
      this.$container.style.display = 'none';
    }
  }

  /**
   * remove layer
   */
  remove () {
    this._unRegisterEvents();
    delete this.$Map;
    this.$container.parentNode.removeChild(this.$container);
  }

  /**
   * creat eclayer container
   * @param map
   * @param options
   * @private
   */
  _createLayerContainer (map, options) {
    const container = (this.$container = document.createElement('div'));
    container.style.position = 'absolute';
    container.style.top = '0px';
    container.style.left = '0px';
    container.style.right = '0px';
    container.style.bottom = '0px';
    this.prepareCanvas();
    let _target = getTarget(options['target']);
    if (_target && _target[0] && _target[0] instanceof Element) {
      _target[0].appendChild(container);
    } else {
      let _target = getTarget('.ol-overlaycontainer');
      if (_target && _target[0] && _target[0] instanceof Element) {
        _target[0].appendChild(container);
      } else {
        map.getViewport().appendChild(container);
      }
    }
  }

  /**
   * Reset the container size
   * @private
   */
  _resizeContainer () {
    const size = this.getMap().getSize();
    this.$container.style.height = size[1] + 'px';
    this.$container.style.width = size[0] + 'px';
  }

  /**
   * clear chart and redraw
   * @private
   */
  _clearAndRedraw () {
    if (this.$container && this.$container.style.display === 'none') {
      return;
    }
    this.render();
    this.dispatchEvent({
      type: 'redraw',
      source: this
    });
  }

  /**
   * handle map resize
   */
  onResize () {
    this._resizeContainer();
    this._clearAndRedraw();
    this.dispatchEvent({
      type: 'change:size',
      source: this
    });
  }

  /**
   * handle zoom end events
   */
  onZoomEnd () {
    this.$options['hideOnZooming'] && this.show();
    this._clearAndRedraw();
    this.dispatchEvent({
      type: 'zoomend',
      source: this
    });
  }

  /**
   * handle rotate end events
   */
  onDragRotateEnd () {
    this.$options['hideOnRotating'] && this.show();
    this._clearAndRedraw();
    this.dispatchEvent({
      type: 'change:rotation',
      source: this
    });
  }

  /**
   * handle move start events
   */
  onMoveStart () {
    this.$options['hideOnMoving'] && this.hide();
    this.dispatchEvent({
      type: 'movestart',
      source: this
    });
  }

  /**
   * handle move end events
   */
  onMoveEnd () {
    this.$options['hideOnMoving'] && this.show();
    this._clearAndRedraw();
    this.dispatchEvent({
      type: 'moveend',
      source: this
    });
  }

  /**
   * handle center change
   * @param event
   */
  onCenterChange (event) {
    this._clearAndRedraw();
    this.dispatchEvent({
      type: 'change:center',
      source: this
    });
  }

  /**
   * register events
   * @private
   */
  _registerEvents () {
    // https://github.com/openlayers/openlayers/issues/7284
    const Map = this.$Map;
    const view = Map.getView();
    if (this.$options.forcedPrecomposeRerender) {
      this.precomposeListener_ = Map.on('precompose', this.reRender.bind(this));
    }
    this.sizeChangeListener_ = Map.on('change:size', this.onResize.bind(this));
    this.resolutionListener_ = view.on('change:resolution', this.onZoomEnd.bind(this));
    this.centerChangeListener_ = view.on('change:center', this.onCenterChange.bind(this));
    this.rotationListener_ = view.on('change:rotation', this.onDragRotateEnd.bind(this));
    this.movestartListener_ = Map.on('movestart', this.onMoveStart.bind(this));
    this.moveendListener_ = Map.on('moveend', this.onMoveEnd.bind(this));
  }

  /**
   * un register events
   * @private
   */
  _unRegisterEvents () {
    unByKey(this.sizeChangeListener_);
    if (this.$options.forcedPrecomposeRerender) {
      unByKey(this.precomposeListener_);
    }
    unByKey(this.resolutionListener_);
    unByKey(this.centerChangeListener_);
    unByKey(this.rotationListener_);
    unByKey(this.movestartListener_);
    unByKey(this.moveendListener_);
    this.sizeChangeListener_ = null;
    this.precomposeListener_ = null;
    this.sizeChangeListener_ = null;
    this.resolutionListener_ = null;
    this.centerChangeListener_ = null;
    this.rotationListener_ = null;
    this.movestartListener_ = null;
    this.moveendListener_ = null;
  }

  /**
   * render
   */
  render () {
    if (!this.$container) {
      this._createLayerContainer(this.$Map, this.$options);
      this._resizeContainer();
    }
    if (this.$Map) {
      const { layers } = this.$options;
      const view = this.$Map.getView();
      const zoom = view.getZoom();
      const center = view.getCenter();
      const nCenter = transform(center, view.getProjection(), 'EPSG:4326');
      const _props = {
        initialViewState: {
          latitude: nCenter[1],
          longitude: nCenter[0],
          zoom: zoom - 1,
          bearing: 0,
          pitch: 0
        },
        canvas: this._canvas,
        _customRender: true,
        layers: layers
      };
      if (!this.deckLayer) {
        this.deckLayer = new deck.Deck(_props); // eslint-disable-line
        // this.clearLayer();
      } else {
        // this.clearLayer();
        this.deckLayer.setProps(Object.assign({
          viewState: _props.initialViewState
        }, _props));
      }
    }
  }

  /**
   * re-render
   */
  reRender () {
    this._clearAndRedraw();
  }

  /**
   * get size
   * @returns {ol.Size|*}
   * @private
   */
  _getMapSize () {
    if (!this.getMap()) return;
    return this.getMap().getSize();
  }

  clearLayer () {
    if (!this.deckLayer) {
      return;
    }
    const layerManager = this.deckLayer.layerManager;
    layerManager && layerManager.context.gl.clear(layerManager.context.gl.COLOR_BUFFER_BIT);
    return this;
  }

  prepareCanvas () {
    const size = this._getMapSize();
    const width = size[0];
    const height = size[1];
    if (!this._canvas) {
      this._canvas = createCanvas(width, height);
      document.body.appendChild(this._canvas);
    } else {
      this._canvas.width = width;
      this._canvas.height = height;
    }
  }
}

export default DeckGl;

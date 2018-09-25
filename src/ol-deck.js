import Deck from './deck';
import { toLonLat } from 'ol/proj';
import ImageLayer from 'ol/layer/Image';
import ImageCanvas from 'ol/source/ImageCanvas';
import { createCanvas, createContext } from './helper';

const glOptions = {
  alpha: true,
  antialias: true,
  preserveDrawingBuffer: true
};

class DeckLayer extends ImageLayer {
  constructor (props, options = {}) {
    super(options);

    /**
     * this canvas
     * @type {null}
     * @private
     */
    this._canvas = null;

    /**
     * props
     */
    this.props = props;

    /**
     * options
     * @type {{}}
     */
    this.options = options;

    this.setSource(
      new ImageCanvas({
        logo: options.logo,
        state: options.state,
        attributions: options.attributions,
        resolutions: options.resolutions,
        canvasFunction: this.canvasFunction.bind(this),
        projection: options.hasOwnProperty('projection')
          ? options.projection
          : 'EPSG:3857',
        ratio: options.hasOwnProperty('ratio') ? options.ratio : 1
      })
    );

    this.on('precompose', this.redraw.bind(this), this);
  }

  /**
   * re-draw
   */
  redraw (event) {
    this.draw(event);
  }

  /**
   * get map current extent
   * @returns {{createCenterConstraint?, createResolutionConstraint?, createRotationConstraint?, isNoopAnimation?}|module:ol/View|*|module:ol/extent~Extent}
   * @private
   */
  _getMapExtent () {
    if (!this.getMap()) return;
    const size = this._getMapSize();
    const _view = this.getMap().getView();
    return _view && _view.calculateExtent(size);
  }

  /**
   * get size
   * @private
   */
  _getMapSize () {
    if (!this.getMap()) return;
    return this.getMap().getSize();
  }

  /**
   * canvas constructor
   * @param extent
   * @param resolution
   * @param pixelRatio
   * @param size
   * @param projection
   * @returns {*}
   */
  canvasFunction (extent, resolution, pixelRatio, size, projection) {
    if (!this._canvas) {
      this._canvas = createCanvas(size[0], size[1], pixelRatio);
    } else {
      this._canvas.width = size[0];
      this._canvas.height = size[1];
    }
    if (resolution <= this.get('maxResolution')) {
      this.render({
        extent: extent,
        size: size,
        pixelRatio: pixelRatio,
        projection: projection
      });
    } else {
      // console.warn('超出所设置最大分辨率！')
    }
    return this._canvas;
  }

  getContext () {
    if (!this._context) {
      this._context = createContext(this._canvas, Object.assign(glOptions, this.options.glOptions || {}));
    }
    return this._context;
  }

  _getViewState () {
    const map = this.getMap();
    const view = map.getView();
    const zoom = view.getZoom();
    const maxZoom = view.getMaxZoom();
    const center = view.getCenter();
    const latLon = toLonLat(center);
    const pitch = 0;
    const bearing = 0;
    return {
      latitude: latLon[1],
      longitude: latLon[0],
      zoom: zoom - 1,
      bearing: bearing,
      pitch: pitch,
      maxZoom: maxZoom
    }
  }

  render () {
    const context = this.getContext();
    if (!context) return;
    const viewState = this._getViewState();
    const { layers } = this.props;
    if (this.deck) {
      this.deck.setProps({ viewState, layers });
      this.deck._drawLayers();
    } else {
      this.deck = new Deck({
        controller: false,
        _customRender: true,
        viewState: viewState,
        glOptions: {
          'alpha': true,
          'antialias': true,
          'preserveDrawingBuffer': true
        }
      });
      this.deck._setGLContext(context);
      this.deck.setProps({
        layers: layers
      });
    }
    return this;
  }

  draw () {}

  /**
   * set map
   * @param map
   */
  setMap (map) {
    ImageLayer.prototype.setMap.call(this, map);
  }

  /**
   * get map
   */
  getMap () {
    return this.get('map');
  }
}

export default DeckLayer;

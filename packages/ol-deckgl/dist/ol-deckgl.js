/*!
 * author: FDD <smileFDD@gmail.com> 
 * ol-deckgl v0.0.1
 * build-time: 2018-9-5 22:3
 * LICENSE: MIT
 * (c) 2018-2018 https://sakitam-fdd.github.io/ol-deckgl
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('ol/Observable'), require('ol'), require('ol/proj')) :
  typeof define === 'function' && define.amd ? define(['ol/Observable', 'ol', 'ol/proj'], factory) :
  (global.DeckGl = factory(global.Observable,global.ol,global.proj));
}(this, (function (Observable,ol,proj) { 'use strict';

  var classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  var inherits = function (subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  };

  var possibleConstructorReturn = function (self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  };

  var getTarget = function getTarget(selector) {
    var dom = function () {
      var found = void 0;
      return document && /^#([\w-]+)$/.test(selector) ? (found = document.getElementById(RegExp.$1)) ? [found] : [] : Array.prototype.slice.call(/^\.([\w-]+)$/.test(selector) ? document.getElementsByClassName(RegExp.$1) : /^[\w-]+$/.test(selector) ? document.getElementsByTagName(selector) : document.querySelectorAll(selector));
    }();
    return dom;
  };

  var createCanvas = function createCanvas(width, height) {
    var scaleFactor = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;

    if (typeof document !== 'undefined') {
      var canvas = document.createElement('canvas');
      canvas.width = width * scaleFactor;
      canvas.height = height * scaleFactor;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      return canvas;
    }
  };

  var _options = {
    forcedRerender: false,
    forcedPrecomposeRerender: false,
    hideOnZooming: false,
    hideOnMoving: false,
    hideOnRotating: false };

  var DeckGl = function (_NObject) {
    inherits(DeckGl, _NObject);

    function DeckGl() {
      var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      var map = arguments[1];
      classCallCheck(this, DeckGl);

      var _this = possibleConstructorReturn(this, _NObject.call(this));

      _this.$options = Object.assign(_options, options);

      _this.$Map = null;

      if (map) _this.appendTo(map);
      return _this;
    }

    DeckGl.prototype.appendTo = function appendTo(map) {
      var _this2 = this;

      if (map && map instanceof ol.Map) {
        this.$Map = map;
        this.$Map.once('postrender', function (event) {
          _this2.render();
        });
        this.$Map.renderSync();
        this._unRegisterEvents();
        this._registerEvents();
      } else {
        throw new Error('not map object');
      }
    };

    DeckGl.prototype.getMap = function getMap() {
      return this.$Map;
    };

    DeckGl.prototype._isVisible = function _isVisible() {
      return this.$container && this.$container.style.display === '';
    };

    DeckGl.prototype.show = function show() {
      if (this.$container) {
        this.$container.style.display = '';
      }
    };

    DeckGl.prototype.hide = function hide() {
      if (this.$container) {
        this.$container.style.display = 'none';
      }
    };

    DeckGl.prototype.remove = function remove() {
      this._unRegisterEvents();
      delete this.$Map;
      this.$container.parentNode.removeChild(this.$container);
    };

    DeckGl.prototype._createLayerContainer = function _createLayerContainer(map, options) {
      var container = this.$container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.top = '0px';
      container.style.left = '0px';
      container.style.right = '0px';
      container.style.bottom = '0px';
      this.prepareCanvas();
      var _target = getTarget(options['target']);
      if (_target && _target[0] && _target[0] instanceof Element) {
        _target[0].appendChild(container);
      } else {
        var _target2 = getTarget('.ol-overlaycontainer');
        if (_target2 && _target2[0] && _target2[0] instanceof Element) {
          _target2[0].appendChild(container);
        } else {
          map.getViewport().appendChild(container);
        }
      }
    };

    DeckGl.prototype._resizeContainer = function _resizeContainer() {
      var size = this.getMap().getSize();
      this.$container.style.height = size[1] + 'px';
      this.$container.style.width = size[0] + 'px';
    };

    DeckGl.prototype._clearAndRedraw = function _clearAndRedraw() {
      if (this.$container && this.$container.style.display === 'none') {
        return;
      }
      this.render();
      this.dispatchEvent({
        type: 'redraw',
        source: this
      });
    };

    DeckGl.prototype.onResize = function onResize() {
      this._resizeContainer();
      this._clearAndRedraw();
      this.dispatchEvent({
        type: 'change:size',
        source: this
      });
    };

    DeckGl.prototype.onZoomEnd = function onZoomEnd() {
      this.$options['hideOnZooming'] && this.show();
      this._clearAndRedraw();
      this.dispatchEvent({
        type: 'zoomend',
        source: this
      });
    };

    DeckGl.prototype.onDragRotateEnd = function onDragRotateEnd() {
      this.$options['hideOnRotating'] && this.show();
      this._clearAndRedraw();
      this.dispatchEvent({
        type: 'change:rotation',
        source: this
      });
    };

    DeckGl.prototype.onMoveStart = function onMoveStart() {
      this.$options['hideOnMoving'] && this.hide();
      this.dispatchEvent({
        type: 'movestart',
        source: this
      });
    };

    DeckGl.prototype.onMoveEnd = function onMoveEnd() {
      this.$options['hideOnMoving'] && this.show();
      this._clearAndRedraw();
      this.dispatchEvent({
        type: 'moveend',
        source: this
      });
    };

    DeckGl.prototype.onCenterChange = function onCenterChange(event) {
      this._clearAndRedraw();
      this.dispatchEvent({
        type: 'change:center',
        source: this
      });
    };

    DeckGl.prototype._registerEvents = function _registerEvents() {
      var Map = this.$Map;
      var view = Map.getView();
      if (this.$options.forcedPrecomposeRerender) {
        this.precomposeListener_ = Map.on('precompose', this.reRender.bind(this));
      }
      this.sizeChangeListener_ = Map.on('change:size', this.onResize.bind(this));
      this.resolutionListener_ = view.on('change:resolution', this.onZoomEnd.bind(this));
      this.centerChangeListener_ = view.on('change:center', this.onCenterChange.bind(this));
      this.rotationListener_ = view.on('change:rotation', this.onDragRotateEnd.bind(this));
      this.movestartListener_ = Map.on('movestart', this.onMoveStart.bind(this));
      this.moveendListener_ = Map.on('moveend', this.onMoveEnd.bind(this));
    };

    DeckGl.prototype._unRegisterEvents = function _unRegisterEvents() {
      Observable.unByKey(this.sizeChangeListener_);
      if (this.$options.forcedPrecomposeRerender) {
        Observable.unByKey(this.precomposeListener_);
      }
      Observable.unByKey(this.resolutionListener_);
      Observable.unByKey(this.centerChangeListener_);
      Observable.unByKey(this.rotationListener_);
      Observable.unByKey(this.movestartListener_);
      Observable.unByKey(this.moveendListener_);
      this.sizeChangeListener_ = null;
      this.precomposeListener_ = null;
      this.sizeChangeListener_ = null;
      this.resolutionListener_ = null;
      this.centerChangeListener_ = null;
      this.rotationListener_ = null;
      this.movestartListener_ = null;
      this.moveendListener_ = null;
    };

    DeckGl.prototype.render = function render() {
      if (!this.$container) {
        this._createLayerContainer(this.$Map, this.$options);
        this._resizeContainer();
      }
      if (this.$Map) {
        var layers = this.$options.layers;

        var view = this.$Map.getView();
        var zoom = view.getZoom();
        var center = view.getCenter();
        var nCenter = proj.transform(center, view.getProjection(), 'EPSG:4326');
        var _props = {
          layers: layers,
          gl: this._canvas.getContext('webgl2'),

          initialViewState: {
            latitude: nCenter[1],
            longitude: nCenter[0],
            zoom: zoom - 1,
            bearing: 0,
            pitch: 0
          }
        };
        if (!this.deckLayer) {
          this.deckLayer = new deck.Deck(_props);
          this.clearLayer();
        } else {
          this.clearLayer();
          this.deckLayer.setProps(Object.assign({
            viewState: _props.initialViewState
          }, _props));
        }
      }
    };

    DeckGl.prototype.reRender = function reRender() {
      this._clearAndRedraw();
    };

    DeckGl.prototype._getMapSize = function _getMapSize() {
      if (!this.getMap()) return;
      return this.getMap().getSize();
    };

    DeckGl.prototype.clearLayer = function clearLayer() {
      if (!this.deckLayer) {
        return;
      }
      var layerManager = this.deckLayer.layerManager;
      layerManager && layerManager.context.gl.clear(layerManager.context.gl.COLOR_BUFFER_BIT);
      return this;
    };

    DeckGl.prototype.prepareCanvas = function prepareCanvas() {
      var size = this._getMapSize();
      var width = size[0];
      var height = size[1];
      if (!this._canvas) {
        this._canvas = createCanvas(width, height);
        this.$container.appendChild(this._canvas);
      } else {
        this._canvas.width = width;
        this._canvas.height = height;
      }
    };

    return DeckGl;
  }(ol.Object);

  return DeckGl;

})));

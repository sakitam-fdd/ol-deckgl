import Viewport from './viewport';
import {
  pixelsToWorld,
  getViewMatrix,
  addMetersToLngLat,
  getProjectionParameters,
  fitBounds
} from 'viewport-mercator-project';

// TODO - import from math.gl
/* eslint-disable camelcase */
import vec2_add from 'gl-vec2/add';
import vec2_negate from 'gl-vec2/negate';
import assert from '@deck.gl/core/dist/esm/utils/assert';
const ERR_ARGUMENT = 'Illegal argument to WebMercatorViewport';

export default class WebMercatorViewport extends Viewport {
  /**
     * @classdesc
     * Creates view/projection matrices from mercator params
     * Note: The Viewport is immutable in the sense that it only has accessors.
     * A new viewport instance should be created if any parameters have changed.
     */
  /* eslint-disable complexity, max-statements */
  constructor (opts = {}) {
    const {
      latitude = 0,
      longitude = 0,
      zoom = 11,
      pitch = 0,
      bearing = 0,
      farZMultiplier = 10,
      orthographic = false,
            targetMap = null // eslint-disable-line
    } = opts;

    let { width, height, altitude = 1.5 } = opts;

    // Silently allow apps to send in 0,0 to facilitate isomorphic render etc
    width = width || 1;
    height = height || 1;

    // Altitude - prevent division by 0
    // TODO - just throw an Error instead?
    altitude = Math.max(0.75, altitude);

    const { fov, aspect, focalDistance, near, far } = getProjectionParameters({
      width,
      height,
      pitch,
      altitude,
      farZMultiplier
    });

    // The uncentered matrix allows us two move the center addition to the
    // shader (cheap) which gives a coordinate system that has its center in
    // the layer's center position. This makes rotations and other modelMatrx
    // transforms much more useful.
    const viewMatrixUncentered = getViewMatrix({
      height,
      pitch,
      bearing,
      altitude,
      flipY: true
    });

    // TODO / hack - prevent vertical offsets if not FirstPersonViewport
    const position = opts.position && [opts.position[0], opts.position[1], 0];

    const viewportOpts = Object.assign({}, opts, {
      // x, y,
      width,
      height,

      // view matrix
      viewMatrix: viewMatrixUncentered,
      longitude,
      latitude,
      zoom,
      position,

      // projection matrix parameters
      orthographic,
      fovyRadians: fov,
      aspect,
      // TODO Viewport is already carefully set up to "focus" on ground, so can't use focal distance
      orthographicFocalDistance: focalDistance,
      near,
      far
    });

    super(viewportOpts);

    // Save parameters
    this.latitude = latitude;
    this.longitude = longitude;
    this.zoom = zoom;
    this.pitch = pitch;
    this.bearing = bearing;
    this.altitude = altitude;

    this.orthographic = orthographic;

    // Bind methods
    this.metersToLngLatDelta = this.metersToLngLatDelta.bind(this);
    this.lngLatDeltaToMeters = this.lngLatDeltaToMeters.bind(this);
    this.addMetersToLngLat = this.addMetersToLngLat.bind(this);

    Object.freeze(this);
  }
  /* eslint-enable complexity, max-statements */

  /**
     * Converts a meter offset to a lnglat offset
     *
     * Note: Uses simple linear approximation around the viewport center
     * Error increases with size of offset (roughly 1% per 100km)
     *
     * @param {[Number,Number]|[Number,Number,Number]) xyz - array of meter deltas
     * @return {[Number,Number]|[Number,Number,Number]) - array of [lng,lat,z] deltas
   */
  metersToLngLatDelta (xyz) {
    const [x, y, z = 0] = xyz;
    assert(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), ERR_ARGUMENT);
    const { pixelsPerMeter, degreesPerPixel } = this.distanceScales;
    const deltaLng = x * pixelsPerMeter[0] * degreesPerPixel[0];
    const deltaLat = y * pixelsPerMeter[1] * degreesPerPixel[1];
    return xyz.length === 2 ? [deltaLng, deltaLat] : [deltaLng, deltaLat, z];
  }

  /**
     * Converts a lnglat offset to a meter offset
     *
     * Note: Uses simple linear approximation around the viewport center
     * Error increases with size of offset (roughly 1% per 100km)
     *
     * @param {[Number,Number]|[Number,Number,Number]) deltaLngLatZ - array of [lng,lat,z] deltas
     * @return {[Number,Number]|[Number,Number,Number]) - array of meter deltas
   */
  lngLatDeltaToMeters (deltaLngLatZ) {
    const [deltaLng, deltaLat, deltaZ = 0] = deltaLngLatZ;
    assert(
      Number.isFinite(deltaLng) && Number.isFinite(deltaLat) && Number.isFinite(deltaZ),
      ERR_ARGUMENT
    );
    const { pixelsPerDegree, metersPerPixel } = this.distanceScales;
    const deltaX = deltaLng * pixelsPerDegree[0] * metersPerPixel[0];
    const deltaY = deltaLat * pixelsPerDegree[1] * metersPerPixel[1];
    return deltaLngLatZ.length === 2 ? [deltaX, deltaY] : [deltaX, deltaY, deltaZ];
  }

  /**
     * Add a meter delta to a base lnglat coordinate, returning a new lnglat array
     *
     * Note: Uses simple linear approximation around the viewport center
     * Error increases with size of offset (roughly 1% per 100km)
     *
     * @param {[Number,Number]|[Number,Number,Number]) lngLatZ - base coordinate
     * @param {[Number,Number]|[Number,Number,Number]) xyz - array of meter deltas
     * @return {[Number,Number]|[Number,Number,Number]) array of [lng,lat,z] deltas
   */
  addMetersToLngLat (lngLatZ, xyz) {
    return addMetersToLngLat(lngLatZ, xyz);
  }

  /**
     * Get the map center that place a given [lng, lat] coordinate at screen
     * point [x, y]
     *
     * @param {Array} lngLat - [lng,lat] coordinates
     *   Specifies a point on the sphere.
     * @param {Array} pos - [x,y] coordinates
     *   Specifies a point on the screen.
     * @return {Array} [lng,lat] new map center.
     */
  getMapCenterByLngLatPosition ({ lngLat, pos }) {
    const fromLocation = pixelsToWorld(pos, this.pixelUnprojectionMatrix);
    const toLocation = this.projectFlat(lngLat);

    const translate = vec2_add([], toLocation, vec2_negate([], fromLocation));
    const newCenter = vec2_add([], this.center, translate);

    return this.unprojectFlat(newCenter);
  }

  // Legacy method name
  getLocationAtPoint ({ lngLat, pos }) {
    return this.getMapCenterByLngLatPosition({ lngLat, pos });
  }

  /**
     * Returns a new viewport that fit around the given rectangle.
     * Only supports non-perspective mode.
     * @param {Array} bounds - [[lon, lat], [lon, lat]]
     * @param {Number} [options.padding] - The amount of padding in pixels to add to the given bounds.
     * @param {Array} [options.offset] - The center of the given bounds relative to the map's center,
     *    [x, y] measured in pixels.
     * @returns {WebMercatorViewport}
     */
  fitBounds (bounds, options = {}) {
    const { width, height } = this;
    const { longitude, latitude, zoom } = fitBounds(Object.assign({ width, height, bounds }, options));
    return new WebMercatorViewport({ width, height, longitude, latitude, zoom });
  }
}

WebMercatorViewport.displayName = 'WebMercatorViewport';

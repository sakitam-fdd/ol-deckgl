import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { fromLonLat } from 'ol/proj';
import { PolygonLayer } from '@deck.gl/layers';
import DeckGLLayer from '../src/ol-deck';
import { TripsLayer } from '@deck.gl/experimental-layers';

const map = new Map({
  target: 'map4',
  layers: [
    new TileLayer({
      preload: 4,
      source: new OSM({
        url: 'https://cartodb-basemaps-{a-d}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'
      })
    })
  ],
  loadTilesWhileAnimating: true,
  view: new View({
    center: fromLonLat([-74, 40.72]),
    zoom: 13
  })
});

let inited = false;
let deckLayer = null;

const _animate = () => {
  const [loopLength, animationSpeed] = [1800, 30];
  const timestamp = Date.now() / 1000;
  const loopTime = loopLength / animationSpeed;
  const time = ((timestamp % loopTime) / loopTime) * loopLength;
  const layers = [
    new TripsLayer({
      id: 'trips',
      data: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/trips.json',
      getPath: d => d.segments,
      getColor: d => (d.vendor === 0 ? [253, 128, 93] : [23, 184, 190]),
      opacity: 0.3,
      strokeWidth: 2,
      trailLength: 180,
      currentTime: time
    }),
    new PolygonLayer({
      id: 'buildings',
      data: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/trips/buildings.json',
      extruded: true,
      wireframe: false,
      fp64: true,
      opacity: 0.5,
      getPolygon: f => f.polygon,
      getElevation: f => f.height,
      getFillColor: [74, 80, 87],
      lightSettings: {
        lightsPosition: [-74.05, 40.7, 8000, -73.5, 41, 5000],
        ambientRatio: 0.05,
        diffuseRatio: 0.6,
        specularRatio: 0.8,
        lightsStrength: [2.0, 0.0, 0.0, 0.0],
        numberOfLights: 2
      }
    })
  ];
  const props = {
    layers: layers
  };
  if (!inited) {
    inited = true;
    deckLayer = new DeckGLLayer(props, {
      map: map,
      animation: true,
      projection: 'EPSG:3857'
    });
    map.addLayer(deckLayer);
  } else if (deckLayer) {
    deckLayer.setProps(props);
  }
  window.requestAnimationFrame(_animate);
};

_animate();

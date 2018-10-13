import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import OSM from 'ol/source/OSM.js';
import { fromLonLat } from 'ol/proj';
import { GeoJsonLayer } from '@deck.gl/layers';
import { scaleLinear, scaleThreshold } from 'd3-scale';
import DeckGLLayer from '../src/ol-deck';

const map = new Map({
  target: 'map3',
  layers: [
    new TileLayer({
      preload: 4,
      source: new OSM()
    })
  ],
  loadTilesWhileAnimating: true,
  view: new View({
    center: fromLonLat([-100, 38]),
    zoom: 6
  })
});

function getKey ({ state, type, id }) {
  return `${state}-${type}-${id}`;
}

const COLOR_SCALE = scaleThreshold()
  .domain([0, 4, 8, 12, 20, 32, 52, 84, 136, 220])
  .range([
    [26, 152, 80],
    [102, 189, 99],
    [166, 217, 106],
    [217, 239, 139],
    [255, 255, 191],
    [254, 224, 139],
    [253, 174, 97],
    [244, 109, 67],
    [215, 48, 39],
    [168, 0, 0]
  ]);

const WIDTH_SCALE = scaleLinear()
  .clamp(true)
  .domain([0, 200])
  .range([10, 2000]);

const _aggregateAccidents = (accidents) => {
  const incidents = {};
  const fatalities = {};

  if (accidents) {
    accidents.forEach(a => {
      const r = (incidents[a.year] = incidents[a.year] || {});
      const f = (fatalities[a.year] = fatalities[a.year] || {});
      const key = getKey(a);
      r[key] = a.incidents;
      f[key] = a.fatalities;
    });
  }
  return {
    incidents,
    fatalities
  };
};

const _getLineColor = (f, fatalities) => {
  if (!fatalities) {
    return [200, 200, 200];
  }
  const key = getKey(f.properties);
  const fatalitiesPer1KMile = ((fatalities[key] || 0) / f.properties.length) * 1000;
  return COLOR_SCALE(fatalitiesPer1KMile);
};

const _getLineWidth = (f, incidents) => {
  if (!incidents) {
    return 10;
  }
  const key = getKey(f.properties);
  const incidentsPer1KMile = ((incidents[key] || 0) / f.properties.length) * 1000;
  return WIDTH_SCALE(incidentsPer1KMile);
};

const formatRow = d => ({
  ...d,
  incidents: Number(d.incidents),
  fatalities: Number(d.fatalities)
});

require('d3-request').csv('https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/highway/accidents.csv', formatRow, (error, response) => {
  const year = response[0].year;
  const accidents = response;
  if (!error) {
    const { fatalities, incidents } = _aggregateAccidents(accidents);
    const deckLayer = new DeckGLLayer({
      'layers': [
        new GeoJsonLayer({
          id: 'geojson',
          data: 'https://raw.githubusercontent.com/uber-common/deck.gl-data/master/examples/highway/roads.json',
          opacity: 1,
          stroked: false,
          filled: false,
          lineWidthMinPixels: 0.5,
          parameters: {
            depthTest: false
          },
          getLineColor: f => _getLineColor(f, fatalities[year]),
          getLineWidth: f => _getLineWidth(f, incidents[year]),
          pickable: true,
          updateTriggers: {
            getLineColor: { year },
            getLineWidth: { year }
          },

          transitions: {
            getLineColor: 1000,
            getLineWidth: 1000
          }
        })
      ]
    }, {
      map: map,
      projection: 'EPSG:3857'
    });
    map.addLayer(deckLayer);
  }
});

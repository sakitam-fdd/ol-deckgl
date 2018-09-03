import * as React from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import DeckGl from '../helper/deckgl';
import 'ol/ol.css';
import '../assets/style/art.scss'

class Index extends React.Component {
  constructor (props, context) {
    super(props, context);
    this.state = {
      zoom: 14,
      fov: 0,
      pitch: 0,
      bearing: 0
    };

    this.container = null;
    this.map = null;
  }

  componentDidMount () {
    this.map = new Map({
      target: this.container,
      view: new View({
        center: [-74, 40.72],
        zoom: 13,
        projection: 'EPSG:4326'
      }),
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          })
        })
      ]
    });

    const deckgl = new DeckGl({
      layers: [
        // new deck.i.TripsLayer({
        //     id: 'trips',
        //     data: DATA_URL.TRIPS,
        //     getPath: d => d.segments,
        //     getColor: d => (d.vendor === 0 ? [253, 128, 93] : [23, 184, 190]),
        //     opacity: 0.3,
        //     strokeWidth: 2,
        //     trailLength: 180,
        //     currentTime: 0
        // }),
        new deck.PolygonLayer({ // eslint-disable-line
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
      ]
    });
    deckgl.appendTo(this.map);
  }

  setRef = (x = null) => {
    this.container = x;
  };

  render () {
    return (<div ref={this.setRef} className="map-content"></div>);
  }
}

export default Index;

# ol-deckgl

* ol-deckgl：基于 openlayers5(ol package)扩展的数据可视化插件。

[![Build Status](https://travis-ci.org/sakitam-fdd/ol3Echarts.svg?branch=master)](https://www.travis-ci.org/sakitam-fdd/ol3Echarts)
[![codecov](https://codecov.io/gh/sakitam-fdd/ol3Echarts/branch/master/graph/badge.svg)](https://codecov.io/gh/sakitam-fdd/ol3Echarts)
[![NPM downloads](https://img.shields.io/npm/dm/ol-deckgl.svg)](https://npmjs.org/package/ol-deckgl)
![JS gzip size](http://img.badgesize.io/https://unpkg.com/ol-deckgl/dist/ol-deckgl.js?compression=gzip&label=gzip%20size:%20JS)
[![Npm package](https://img.shields.io/npm/v/ol-deckgl.svg)](https://www.npmjs.org/package/ol-deckgl)
[![GitHub stars](https://img.shields.io/github/stars/sakitam-fdd/ol-deckgl.svg)](https://github.com/sakitam-fdd/ol-deckgl/stargazers)
[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/sakitam-fdd/ol-deckgl/master/LICENSE)

## 下载


```bash
git clone https://github.com/sakitam-fdd/ol-deckgl.git
yarn run bootstrap
yarn run dev
yarn run build
yarn run karma.test
yarn run karma.cover
```

### 安装

#### npm安装

> 注意：npm下存在两个包 [openlayers-deckgl](https://npmjs.org/package/ol-deckgl) 和 [ol-deckgl](https://npmjs.org/package/ol-deckgl)
  前者是在使用 [openlayers](https://npmjs.org/package/openlayers) 或者是 `ol` 的cdn时使用；后者是在使用 [ol](https://npmjs.org/package/ol)
  配合打包工具使用。

```bash
// old openlayers package
npm install openlayers-deckgl --save
import DeckGl from 'openlayers-deckgl'

// ol package
npm install ol-deckgl --save
import DeckGl from 'ol-deckgl'

```

#### cdn

> cdn 引用方式只支持 旧版 `openlayers` 和新版 `ol` 的cdn引用方式，统一使用 `ol-deckgl` 支持。

目前可通过 [unpkg.com](https://unpkg.com/ol-deckgl/dist/ol-deckgl.js) / [jsdelivr](https://cdn.jsdelivr.net/npm/ol-deckgl@0.0.1/dist/ol-deckgl.js) 获取最新版本的资源。

```bash
// jsdelivr (jsdelivr由于缓存原因最好锁定版本号)
https://cdn.jsdelivr.net/npm/ol-deckgl@0.0.1/dist/ol-deckgl.js
https://cdn.jsdelivr.net/npm/ol-deckgl@0.0.1/dist/ol-deckgl.min.js
// npm
https://unpkg.com/ol-deckgl/dist/ol-deckgl.js
https://unpkg.com/ol-deckgl/dist/ol-deckgl.min.js
```

##### openlayers

``` javascript
<div id="map"></div>
<script src="https://cdn.jsdelivr.net/npm/openlayers/dist/ol.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts/dist/echarts.js"></script>
<script src="https://cdn.jsdelivr.net/npm/ol3-echarts/dist/ol3Echarts.js"></script>
<script>
  var Map = new ol.Map({
    target: container,
    layers: [
      new ol.layer.Tile({
        preload: 4,
        source: new ol.source.OSM()
      })
    ],
    loadTilesWhileAnimating: true,
    view: new ol.View({
      projection: 'EPSG:4326',
      center: [120.74758724751435, 30.760422266949334],
      zoom: 8
    })
  });
  var echartslayer = new ol3Echarts(echartsOption, {
    target: '.ol-overlaycontainer',
    source: '',
    destination: '',
    hideOnMoving: true,
    forcedRerender: false,
    forcedPrecomposeRerender: false
  });
  echartslayer.appendTo(Map)
</script>
```

#### ol package & react 

```jsx harmony
import * as React from 'react';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import 'ol/ol.css';
import DeckGl from 'ol-deckgl'

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
        center: [113.53450137499999, 34.44104525],
        projection: 'EPSG:4326',
        zoom: 5 // resolution
      }),
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'http://cache1.arcgisonline.cn/arcgis/rest/services/ChinaOnline' +
            'StreetPurplishBlue/MapServer/tile/{z}/{y}/{x}'
          })
        })
      ]
    });
    const echartslayer = new EChartsLayer(option, {
      hideOnMoving: false,
      hideOnZooming: false,
      forcedPrecomposeRerender: true
    });
    echartslayer.appendTo(this.map);
    window.setTimeout(() => {
      echartslayer.remove();
    }, 10 * 1000)
  }

  setRef = (x = null) => {
    this.container = x;
  };

  render () {
    return (<div ref={this.setRef} className="map-content"></div>);
  }
}
```

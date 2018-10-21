# ol-deckgl

* ol-deckgl：基于 openlayers5(ol package)扩展的数据可视化插件。

## Start

```bash
npm run website
```

## 本地自行编译时的临时解决方案

需要修改 node_moudles 下 `@deck.gl/core` 下 `dist/esm/lib/deck.js`

```javascript
{
    key: "_checkForCanvasSizeChange",
    value: function _checkForCanvasSizeChange() {
      var canvas = this.canvas;

      if (canvas && (this.width !== canvas.clientWidth || this.height !== canvas.clientHeight)) {
        this.width = canvas.clientWidth;
        this.height = canvas.clientHeight;
        return true;
      }

      return false;
    }
  }
```

将 `clientWidth` => `width`; `clientHeight` => `height`。

`@deck.gl/core` 下 `dist/esm/lib/draw-layers.js`

```javascript
var getGLViewport = function getGLViewport(gl, _ref2) {
  var viewport = _ref2.viewport,
      pixelRatio = _ref2.pixelRatio;
  // TODO - dummy default for node
  var height = gl.canvas ? gl.canvas.clientHeight : 100; // Convert viewport top-left CSS coordinates to bottom up WebGL coordinates

  var dimensions = viewport;
  return [dimensions.x * pixelRatio, (height - dimensions.y - dimensions.height) * pixelRatio, dimensions.width * pixelRatio, dimensions.height * pixelRatio];
}; // Helper functions
```

同样的将 `clientHeight` 修改为 `height`;

修改完成后启动 `npm run website`。

/**
 * 判断是否为对象
 * @param value
 * @returns {boolean}
 */
const isObject = (value) => {
  const type = typeof value;
  return value !== null && (type === 'object' || type === 'function');
};

/**
 * get parent container
 * @param selector
 */
const getTarget = (selector) => {
  let dom = (function () {
    let found;
    return document && /^#([\w-]+)$/.test(selector)
      ? (found = document.getElementById(RegExp.$1)) // eslint-disable-line
        ? [found]
        : [] // eslint-disable-line
      : Array.prototype.slice.call(
        /^\.([\w-]+)$/.test(selector)
          ? document.getElementsByClassName(RegExp.$1)
          : /^[\w-]+$/.test(selector)
            ? document.getElementsByTagName(selector)
            : document.querySelectorAll(selector)
      );
  })();
  return dom;
};

/**
 * core create canvas
 * @param width
 * @param height
 * @param scaleFactor
 * @returns {HTMLCanvasElement}
 */
const createCanvas = function (width, height, scaleFactor = 1) {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width * scaleFactor;
    canvas.height = height * scaleFactor;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    return canvas;
  }
};

export { getTarget, isObject, createCanvas };

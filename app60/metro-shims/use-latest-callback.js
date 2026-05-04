"use strict";
// Shim Metro: mesmo API que use-latest-callback (~0.2.x, MIT) quando o pacote em node_modules fica incompleto.
var React = require("react");
var useClientLayoutEffect =
  typeof document !== "undefined" ||
  (typeof navigator !== "undefined" && navigator.product === "ReactNative")
    ? React.useLayoutEffect
    : React.useEffect;

function useLatestCallback(callback) {
  var ref = React.useRef(callback);
  var latestCallback = React.useRef(function latestCallback() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
      args[_i] = arguments[_i];
    }
    return ref.current.apply(this, args);
  }).current;
  useClientLayoutEffect(function () {
    ref.current = callback;
  });
  return latestCallback;
}

module.exports = useLatestCallback;

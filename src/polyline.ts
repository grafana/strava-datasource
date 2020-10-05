/**
 * This file contains code from google-polyline
 * https://github.com/jhermsmeier/node-google-polyline
 *
 * https://github.com/jhermsmeier/node-google-polyline/blob/master/lib/decode.js
 */

const PRECISION = 1e5;

export function decode(value: any) {
  var points: any[] = [];
  var lat = 0;
  var lon = 0;

  integers(value, function(x: number, y: number) {
    lat += x;
    lon += y;
    points.push([lat / PRECISION, lon / PRECISION]);
  });

  return points;
}

export function sign(value: any) {
  return value & 1 ? ~(value >>> 1) : value >>> 1 ;
}

export function integers(value: any, callback: any) {
  var values = 0;
  var x = 0;
  var y = 0;

  var byte = 0;
  var current = 0;
  var bits = 0;

  for (var i = 0; i < value.length; i++) {
    byte = value.charCodeAt(i) - 63;
    current = current | ((byte & 0x1f) << bits);
    bits = bits + 5;

    if (byte < 0x20) {
      if (++values & 1) {
        x = sign(current);
      } else {
        y = sign(current);
        callback(x, y);
      }
      current = 0;
      bits = 0;
    }
  }

  return values;
}

export default {
  decode,
};

import { DisplayValue, TimeRange } from '@grafana/data';
import { DataStream, GRAPH_SMOOTH_WINDOW, StravaMeasurementPreference, StravaQuery, StravaQueryInterval } from 'types';

export const INTERVAL_1h = 3600000;
export const INTERVAL_1d = 86400000;
export const INTERVAL_1w = 604800000;
export const INTERVAL_4w = 2419200000;

export function getAggregationInterval(range: TimeRange): number {
  const interval = range.to.unix() - range.from.unix();
  const interval_ms = interval * 1000;
  switch (true) {
    // 4d
    case interval_ms <= 345600000:
      return INTERVAL_1h; // 1h
    // 90d
    case interval_ms <= 7776000000:
      return INTERVAL_1d; // 1d
    // 1y
    case interval_ms <= 31536000000:
      return INTERVAL_1w; // 1w
    default:
      return INTERVAL_4w; // 4w
  }
}

export function getAggregationIntervalFromTarget(target: StravaQuery): number {
  switch (target.interval) {
    case StravaQueryInterval.Hour:
      return INTERVAL_1h;
    case StravaQueryInterval.Day:
      return INTERVAL_1d;
    case StravaQueryInterval.Week:
      return INTERVAL_1w;
    case StravaQueryInterval.Month:
      return INTERVAL_4w;
    default:
      return INTERVAL_4w;
  }
}

export function getPreferredDistance(value: number, measurementPreference: StravaMeasurementPreference): number {
  return measurementPreference === StravaMeasurementPreference.Feet ? metersToMiles(value) : value;
}

export function getPreferredLenght(value: number, measurementPreference: StravaMeasurementPreference): number {
  return measurementPreference === StravaMeasurementPreference.Feet ? metersToFeet(value) : value;
}

export function getPreferredSpeed(value: number, measurementPreference: StravaMeasurementPreference): number {
  const speedKmph = velocityToSpeed(value);
  return measurementPreference === StravaMeasurementPreference.Feet ? metersToMiles(speedKmph * 1000) : speedKmph;
}

export function getPreferredSpeedUnit(measurementPreference: StravaMeasurementPreference) {
  return measurementPreference === StravaMeasurementPreference.Feet ? 'velocitymph' : 'velocitykmh';
}

export function getPreferredLenghtUnit(measurementPreference: StravaMeasurementPreference) {
  return measurementPreference === StravaMeasurementPreference.Feet ? 'lengthft' : 'lengthm';
}

export function getPreferredPace(value: number, measurementPreference: StravaMeasurementPreference): number {
  const paceMinkm = velocityToPace(value);
  return measurementPreference === StravaMeasurementPreference.Feet ? paceToMiles(paceMinkm) : paceMinkm;
}

export function metersToFeet(value: number): number {
  return value / 0.3048;
}

export function metersToMiles(value: number): number {
  return value / 1609.344;
}

export function paceToMiles(value: number): number {
  return (value * 1609.344) / 1000;
}

export function velocityToPace(mps: number): number {
  if (mps === 0) {
    return 0;
  }
  const pace = Math.fround(1000 / mps);
  // Limit pace to 10 min/km to avoid spikes on graph (pace is a reversed speed)
  return Math.min(10 * 60, pace);
}

export function velocityToSpeed(mps: number): number {
  // m/s to km/h
  return mps * 3.6;
}

export function velocityDataToPace(data: Array<number | null>, mp: StravaMeasurementPreference): Array<number | null> {
  for (let i = 0; i < data.length; i++) {
    // m/s to min/km
    const point = data[i];
    if (point != null) {
      const paceMinkm = velocityToPace(point);
      data[i] = mp === StravaMeasurementPreference.Feet ? paceToMiles(paceMinkm) : paceMinkm;
    }
  }
  return data;
}

export function velocityDataToSpeed(data: Array<number | null>, mp: StravaMeasurementPreference): Array<number | null> {
  for (let i = 0; i < data.length; i++) {
    // m/s to km/h
    const point = data[i];
    if (point != null) {
      const speedKmph = velocityToSpeed(point);
      data[i] = mp === StravaMeasurementPreference.Feet ? metersToMiles(speedKmph * 1000) : speedKmph;
    }
  }
  return data;
}

export function metersDataToFeet(data: Array<number | null>, mp: StravaMeasurementPreference): Array<number | null> {
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    if (point != null) {
      data[i] = mp === StravaMeasurementPreference.Feet ? metersToFeet(point) : point;
    }
  }
  return data;
}

export function smoothVelocityData(data: Array<number | null>): Array<number | null> {
  // It's not possible to calculate MA if n greater than number of points
  const n = Math.min(GRAPH_SMOOTH_WINDOW, data.length);

  const sma = [];
  let w_sum = 0;
  let w_count = 0;
  let point: number | null = null;

  // Initial window
  for (let i = n; i > 0; i--) {
    point = data[n - i];
    if (point != null) {
      w_sum += point;
      w_count++;
    }
  }
  for (let i = 0; i < n; i++) {
    sma.push(w_sum / w_count);
  }

  for (let i = n; i < data.length; i++) {
    w_sum = 0;
    w_count = 0;
    for (let j = 0; j < n; j++) {
      point = data[i - j];
      if (point != null) {
        w_sum += point;
        w_count++;
      }
    }
    sma.push(w_sum / w_count);
  }
  return sma;
}

export const paceDisplayProcessor = (value: any): DisplayValue => {
  let text = '';
  const displayValue: DisplayValue = {
    numeric: value,
    text,
  };

  if (value) {
    const minuntes = Math.floor(value / 60);
    const seconds = Math.round(value - minuntes * 60);
    text = `${minuntes}:${seconds}`;
    displayValue.text = text;
    displayValue.suffix = ' /km';
  }
  return displayValue;
};

// Expands stream data to normal array with nulls for non-existing points.
// Data comes as a kind of sparce array. Time stream contains offset of data
// points, for example:
// heartrate: [70,81,82,81,99,96,97,98,99]
// time:      [0, 4, 5, 6, 20,21,22,23,24]
// So last value of the time stream is a highest index in data array
export function expandDataStream<T>(
  dataStream: DataStream<T>,
  timeStream: DataStream<number>,
  startTS: number,
  startIndex: number,
  endIndex: number
): [Array<T | null>, number[]] {
  const streamLength: number = timeStream.data[endIndex] - timeStream.data[startIndex];
  const streamValues = new Array<T | null>(streamLength).fill(null);
  const segmentTicks = new Array<number>(0);

  const firstTsIndex = timeStream.data[startIndex];
  let ts = startTS + firstTsIndex;
  for (let i = startIndex; i < startIndex + streamLength; i++) {
    segmentTicks.push(ts * 1000);
    ts++;
  }
  for (let i = startIndex; i < endIndex; i++) {
    streamValues[timeStream.data[i] - firstTsIndex] = dataStream.data[i];
  }

  return [streamValues, segmentTicks];
}

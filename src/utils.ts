import { DisplayValue } from '@grafana/data';

export function velocityToPace(mps: number): number {
  if (mps === 0) {
    return 0;
  }
  const pace = Math.fround(1000 / mps);
  // Limit pace to 10 min/km to avoid spikes on graph (pace is a reversed speed)
  return Math.min(10 * 60, pace);
}

export function velocityToSpeed(mps: number): number {
  return mps * 3.6;
}

export function velocityDataToPace(data: Array<number | null>): Array<number | null> {
  for (let i = 0; i < data.length; i++) {
    // m/s to min/km
    const point = data[i];
    if (point != null) {
      data[i] = velocityToPace(point);
    }
  }
  return data;
}

export function velocityDataToSpeed(data: Array<number | null>): Array<number | null> {
  for (let i = 0; i < data.length; i++) {
    // m/s to km/h
    const point = data[i];
    if (point != null) {
      data[i] = point * 3.6;
    }
  }
  return data;
}

export function smoothVelocityData(data: Array<number | null>): Array<number | null> {
  // It's not possible to calculate MA if n greater than number of points
  const SMOOTH_RATIO = 20;
  const n = Math.min(SMOOTH_RATIO, data.length);

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

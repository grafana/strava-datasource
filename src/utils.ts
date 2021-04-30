export function velocityToPace(mps: number): number {
  if (mps === 0) {
    return 0;
  }
  const pace = Math.fround(1000 / (mps * 60));
  return Math.min(10, pace);
}

export function velocityToSpeed(mps: number): number {
  return mps * 3.6;
}

export function velocityDataToPace(data: number[]): number[] {
  for (let i = 0; i < data.length; i++) {
    // m/s to min/km
    data[i] = velocityToPace(data[i]);
  }
  return data;
}

export function velocityDataToSpeed(data: number[]): number[] {
  for (let i = 0; i < data.length; i++) {
    // m/s to km/h
    data[i] = data[i] * 3.6;
  }
  return data;
}

export function smoothVelocityData(data: number[]): number[] {
  // It's not possible to calculate MA if n greater than number of points
  const SMOOTH_RATIO = 20;
  const n = Math.min(SMOOTH_RATIO, data.length);

  const sma = [];
  let w_sum = 0;

  // Initial window
  for (let i = n; i > 0; i--) {
    w_sum += data[n - i];
  }
  for (let i = 0; i < n; i++) {
    sma.push(w_sum / n);
  }

  for (let i = n; i < data.length; i++) {
    w_sum = 0;
    for (let j = 0; j < n; j++) {
      w_sum += data[i - j];
    }
    sma.push(w_sum / n);
  }
  return sma;
}

import { getActivityTypeLabel, SportType, STRAVA_SPORT_TYPES } from './types';

describe('Strava sport types', () => {
  const sports: Array<[SportType, string]> = [
    ['Basketball', 'Basketball'],
    ['Cricket', 'Cricket'],
    ['Dance', 'Dance'],
    ['Padel', 'Padel'],
    ['PhysicalTherapy', 'Physical Therapy'],
    ['Volleyball', 'Volleyball'],
  ];

  it.each(sports)('includes %s with the label %s', (sport, label) => {
    expect(STRAVA_SPORT_TYPES).toContain(sport);
    expect(getActivityTypeLabel(sport)).toBe(label);
  });
});

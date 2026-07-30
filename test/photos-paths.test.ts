import { describe, it, expect } from 'vitest';
import {
  parsePhotoPath,
  isDatedShoot,
  compareShoots,
  comparePhotos,
  groupBySubject,
  assertKnownSubjects,
  shootLabel,
  photoAlt,
} from '../src/lib/photos/paths';

describe('parsePhotoPath', () => {
  it('splits a glob key into shoot, subject, and file', () => {
    expect(parsePhotoPath('../../assets/photos/2026-07-23/blue/blue-01.jpg')).toEqual({
      shoot: '2026-07-23',
      subject: 'blue',
      file: 'blue-01.jpg',
    });
  });

  it('handles an absolute path just as well', () => {
    expect(parsePhotoPath('/repo/src/assets/photos/pre-litter/coco/coco-07.jpg')).toEqual({
      shoot: 'pre-litter',
      subject: 'coco',
      file: 'coco-07.jpg',
    });
  });

  it('throws when the path is not under src/assets/photos', () => {
    expect(() => parsePhotoPath('../../assets/litter/hero.jpg')).toThrow(/not under/i);
  });

  it('throws when the path is missing a subject folder', () => {
    expect(() => parsePhotoPath('../../assets/photos/2026-07-23/blue-01.jpg')).toThrow(
      /shoot\/subject\/file/i,
    );
  });

  it('throws when the path is nested too deeply', () => {
    expect(() => parsePhotoPath('../../assets/photos/2026-07-23/blue/extra/blue-01.jpg')).toThrow(
      /shoot\/subject\/file/i,
    );
  });
});

describe('isDatedShoot', () => {
  it('accepts an ISO date folder', () => {
    expect(isDatedShoot('2026-07-23')).toBe(true);
  });

  it('rejects a slug folder', () => {
    expect(isDatedShoot('pre-litter')).toBe(false);
  });

  it('rejects a partial date', () => {
    expect(isDatedShoot('2026-07')).toBe(false);
  });
});

describe('compareShoots', () => {
  it('puts the newer dated shoot first', () => {
    expect(compareShoots('2026-07-24', '2026-07-23')).toBeLessThan(0);
    expect(compareShoots('2026-06-26', '2026-07-07')).toBeGreaterThan(0);
  });

  it('puts undated shoots after every dated shoot', () => {
    expect(compareShoots('pre-litter', '2026-07-24')).toBeGreaterThan(0);
    expect(compareShoots('2026-06-26', 'pre-litter')).toBeLessThan(0);
  });

  it('orders two undated shoots alphabetically', () => {
    expect(compareShoots('archive', 'pre-litter')).toBeLessThan(0);
  });

  it('sorts a real shoot list newest first, undated last', () => {
    const shoots = ['2026-06-26', 'pre-litter', '2026-07-24', '2026-07-07', '2026-07-23'];
    expect([...shoots].sort(compareShoots)).toEqual([
      '2026-07-24',
      '2026-07-23',
      '2026-07-07',
      '2026-06-26',
      'pre-litter',
    ]);
  });
});

describe('comparePhotos', () => {
  const ref = (shoot: string, file: string) => ({ shoot, subject: 'blue', file });

  it('orders by shoot before filename', () => {
    expect(comparePhotos(ref('2026-07-24', 'blue-09.jpg'), ref('2026-07-23', 'blue-01.jpg'))).toBeLessThan(0);
  });

  it('falls back to filename within one shoot', () => {
    expect(comparePhotos(ref('2026-07-24', 'blue-01.jpg'), ref('2026-07-24', 'blue-02.jpg'))).toBeLessThan(0);
  });
});

describe('groupBySubject', () => {
  it('groups by subject and sorts each list newest shoot first', () => {
    const refs = [
      { shoot: '2026-07-07', subject: 'blue', file: 'blue-01.jpg' },
      { shoot: '2026-07-24', subject: 'pink', file: 'pink-02.jpg' },
      { shoot: '2026-07-24', subject: 'blue', file: 'blue-02.jpg' },
      { shoot: '2026-07-24', subject: 'blue', file: 'blue-01.jpg' },
      { shoot: '2026-07-23', subject: 'blue', file: 'blue-01.jpg' },
    ];

    const grouped = groupBySubject(refs);

    expect(Object.keys(grouped).sort()).toEqual(['blue', 'pink']);
    expect(grouped.blue.map((r) => `${r.shoot}/${r.file}`)).toEqual([
      '2026-07-24/blue-01.jpg',
      '2026-07-24/blue-02.jpg',
      '2026-07-23/blue-01.jpg',
      '2026-07-07/blue-01.jpg',
    ]);
  });

  it('does not mutate the input array', () => {
    const refs = [
      { shoot: '2026-07-07', subject: 'blue', file: 'blue-01.jpg' },
      { shoot: '2026-07-24', subject: 'blue', file: 'blue-01.jpg' },
    ];
    const snapshot = refs.map((r) => r.shoot);

    groupBySubject(refs);

    expect(refs.map((r) => r.shoot)).toEqual(snapshot);
  });
});

const COLLARS = ['Blue', 'Black', 'Brown', 'Yellow', 'Orange', 'Pink', 'Purple', 'Red', 'Green'];

describe('assertKnownSubjects', () => {
  const allSubjects = [...COLLARS.map((c) => c.toLowerCase()), 'group', 'coco', 'first-days'];

  it('accepts the real subject set', () => {
    expect(() => assertKnownSubjects(allSubjects, COLLARS)).not.toThrow();
  });

  it('rejects a subject folder that is neither a collar nor a known extra', () => {
    expect(() => assertKnownSubjects([...allSubjects, 'teal'], COLLARS)).toThrow(/teal/);
  });

  it('rejects a collar that has no photo folder', () => {
    const missingGreen = allSubjects.filter((s) => s !== 'green');
    expect(() => assertKnownSubjects(missingGreen, COLLARS)).toThrow(/green/);
  });

  it('reports both problems at once', () => {
    const broken = [...allSubjects.filter((s) => s !== 'red'), 'teal'];
    expect(() => assertKnownSubjects(broken, COLLARS)).toThrow(/teal[\s\S]*red|red[\s\S]*teal/);
  });

  it('matches collars case-insensitively', () => {
    expect(() => assertKnownSubjects(allSubjects, ['BLUE', 'Black', 'Brown', 'Yellow', 'Orange', 'Pink', 'Purple', 'Red', 'Green'])).not.toThrow();
  });
});

describe('shootLabel', () => {
  it('formats a dated shoot in US long form', () => {
    expect(shootLabel('2026-07-23')).toBe('July 23, 2026');
  });

  it('does not drift a day due to local time zone', () => {
    expect(shootLabel('2026-01-01')).toBe('January 1, 2026');
  });

  it('returns null for an undated shoot', () => {
    expect(shootLabel('pre-litter')).toBeNull();
  });
});

describe('photoAlt', () => {
  it('names the collar and the shoot date for a puppy', () => {
    expect(photoAlt({ shoot: '2026-07-23', subject: 'blue', file: 'blue-01.jpg' }, 'Blue')).toBe(
      'Blue collar puppy — July 23, 2026',
    );
  });

  it('describes a group shot', () => {
    expect(photoAlt({ shoot: '2026-07-24', subject: 'group', file: 'group-01.jpg' })).toBe(
      "Coco's litter — July 24, 2026",
    );
  });

  it('describes a first-days candid without a date', () => {
    expect(photoAlt({ shoot: '2026-06-26', subject: 'first-days', file: 'first-days-01.jpg' })).toBe(
      "Coco's puppies in their first few days",
    );
  });

  it('dates a Coco photo when the shoot is dated', () => {
    expect(photoAlt({ shoot: '2026-07-24', subject: 'coco', file: 'coco-01.jpg' })).toBe(
      'Coco — July 24, 2026',
    );
  });

  it('omits the date for an undated Coco photo', () => {
    expect(photoAlt({ shoot: 'pre-litter', subject: 'coco', file: 'coco-01.jpg' })).toBe('Coco');
  });

  it('throws for a subject it cannot describe', () => {
    expect(() => photoAlt({ shoot: '2026-07-24', subject: 'teal', file: 'teal-01.jpg' })).toThrow(/teal/);
  });
});

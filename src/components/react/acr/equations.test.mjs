// Tests for ACR/PCR compatibility. Run with:
//   node --experimental-strip-types --test src/components/react/acr/equations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRunwayCode, formatRunwayCode, evaluate, TIRE } from './equations.ts';

test('parses the HW10 runway ratings', () => {
  const a = parseRunwayCode('700/R/C/Y/T');
  assert.deepEqual(a, { pcr: 700, type: 'R', subgrade: 'C', tire: 'Y', method: 'T' });
  assert.equal(formatRunwayCode(a), '700/R/C/Y/T');

  assert.deepEqual(parseRunwayCode('650/F/C/Y/T'),
    { pcr: 650, type: 'F', subgrade: 'C', tire: 'Y', method: 'T' });
  assert.deepEqual(parseRunwayCode('600/F/B/X/T'),
    { pcr: 600, type: 'F', subgrade: 'B', tire: 'X', method: 'T' });

  // Lower case and stray spaces are tolerated.
  assert.deepEqual(parseRunwayCode(' 600/f/b/x/t '),
    { pcr: 600, type: 'F', subgrade: 'B', tire: 'X', method: 'T' });
});

test('rejects malformed ratings', () => {
  assert.equal(parseRunwayCode('700/R/C/Y'), null, 'too few parts');
  assert.equal(parseRunwayCode('700/Q/C/Y/T'), null, 'bad pavement type');
  assert.equal(parseRunwayCode('700/R/E/Y/T'), null, 'bad subgrade code');
  assert.equal(parseRunwayCode('700/R/C/Q/T'), null, 'bad tire code');
  assert.equal(parseRunwayCode('abc/R/C/Y/T'), null, 'non-numeric PCR');
});

test('strength check: ACR at or below PCR is unrestricted', () => {
  const rw = parseRunwayCode('700/R/C/Y/T');
  const v = evaluate(rw, 650, 170);
  assert.equal(v.ok, true);
  assert.equal(v.overload, false);
});

test('an ACR just over the PCR is an occasional overload, not a refusal', () => {
  const rw = parseRunwayCode('650/F/C/Y/T');
  const v = evaluate(rw, 680, 170);          // 4.6% over
  assert.equal(v.ok, false);
  assert.equal(v.overload, true);

  const far = evaluate(rw, 800, 170);        // 23% over
  assert.equal(far.ok, false);
  assert.equal(far.overload, false);
});

test('tire pressure is an independent gate', () => {
  // Code Y allows 181 psi; 200 psi fails even when the strength passes.
  const rw = parseRunwayCode('700/R/C/Y/T');
  const v = evaluate(rw, 600, 200);
  assert.equal(v.ok, false);
  assert.equal(v.overload, false, 'a tire failure is not an overload case');

  // Code X allows 254 psi, so the same aircraft is fine there.
  const rwX = parseRunwayCode('600/F/B/X/T');
  assert.equal(evaluate(rwX, 500, 200).ok, true);

  // Code W is unlimited.
  assert.equal(TIRE.W.psi, null);
  assert.equal(evaluate(parseRunwayCode('600/F/B/W/T'), 500, 300).ok, true);
});

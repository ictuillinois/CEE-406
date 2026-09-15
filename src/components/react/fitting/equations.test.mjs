import test from 'node:test';
import assert from 'node:assert/strict';
import { fitModulus, predict, shearNormalizedModulus, invariants, KPA_PER_PSI } from '../mr/equations.ts';
import { HW2_MR, displayConfinement } from '../mr/data.ts';
import { HW2_CBR } from '../cbr/data.ts';
import { fitTangent, calculateCbrBracket } from '../cbr/equations.ts';
import { makeRows, parseRows, numberOrNaN } from './shared.ts';
const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(b)), `${a} != ${b}`);
const observations = HW2_MR.map(([s3, sd, strain], i) => ({ id: i + 1, s3, sd, strain }));

test('all 30 homework readings remain in the default sample, with original IDs', () => {
  assert.equal(observations.length, 30);
  assert.deepEqual(observations[9], { id: 10, s3: 104.11, sd: 62.19, strain: .0002 });
  assert.deepEqual(observations[7], { id: 8, s3: 68.95, sd: 123.97, strain: .00075 });
  assert.deepEqual(observations[25], { id: 26, s3: 103.42, sd: 93.36, strain: .00018 });
  assert.ok(makeRows(HW2_MR).every(p => p.included));
  assert.deepEqual(HW2_CBR, [[0,0],[.05,10],[.1,60],[.15,75],[.2,90],[.3,110],[.4,125],[.5,135]]);
});
test('both full-data regressions agree with independent NumPy least squares', () => {
  const g = fitModulus(observations, 'generalized');
  near(g.k1, 1288.7674221845034); near(g.k2, .7133195435731182); near(g.k3, -.2642823975430901);
  near(g.r2, .8364174246168843); near(g.r2log, .8943953022064046);
  const b = fitModulus(observations, 'bulk');
  near(b.k1, 6245.027719318767); near(b.k2, .6506838973662068);
  near(b.r2, .8296494933034906); near(b.r2log, .890273470703225);
});
test('synthetic generalized and bulk models recover known coefficients', () => {
  for (const model of ['generalized','bulk']) {
    const truth = { model, k1: model === 'bulk' ? 1400 : 850, k2: .6, k3: -.2, pa: 101.325 };
    const data = [];
    for (const s3 of [20,50,100]) for (const sd of [15,40,80]) data.push({ id: data.length + 1, s3, sd, strain: sd / predict(truth, sd + 3*s3, sd) });
    const fit = fitModulus(data, model);
    near(fit.k1,truth.k1); near(fit.k2,truth.k2); if(model==='generalized')near(fit.k3,truth.k3);
    near(fit.r2,1);near(fit.r2log,1);
    near(predict(fit,1500,200),predict(truth,1500,200));
  }
});
test('generalized fit is consistent under physical stress-unit conversion', () => {
  const kpa = fitModulus(observations,'generalized');
  const psi = fitModulus(observations.map(p => ({ ...p,s3:p.s3/KPA_PER_PSI,sd:p.sd/KPA_PER_PSI })),'generalized',101.325/KPA_PER_PSI);
  near(kpa.k1,psi.k1);near(kpa.k2,psi.k2);near(kpa.k3,psi.k3);
  near(predict(kpa,1400,250)/KPA_PER_PSI,predict(psi,1400/KPA_PER_PSI,250/KPA_PER_PSI));
});
test('invalid, insufficient, and rank-deficient fits fail explicitly', () => {
  assert.equal(fitModulus(observations.slice(0,3),'generalized'),null);
  assert.equal(fitModulus(observations.map(p=>({...p,sd:20})),'generalized'),null);
  for(const bad of [0,-1,Infinity,NaN])assert.equal(fitModulus(observations.map(p=>({...p,strain:bad})),'bulk'),null);
  assert.equal(fitModulus(observations,'generalized',0),null);
  assert.ok(Number.isNaN(predict(fitModulus(observations,'bulk'),100,101)));
});
test('residual signs and stress invariants remain auditable', () => {
  const fit=fitModulus(observations,'generalized');
  for(const p of fit.points){near(p.residual,p.mr-p.predicted);near(p.logResidual,Math.log(p.mr/p.predicted));}
  const p=invariants(observations[0]);near(p.theta,80.45);near(p.mr,18.41/.00015);near(p.tau,Math.SQRT2*18.41/3);
  const reduced=fitModulus(observations.filter(p=>p.id!==5),'generalized');assert.equal(reduced.points.length,29);assert.equal(reduced.points[4].id,6);
});
test('a selected CBR region changes the tangent without searching the other data', () => {
  const points=HW2_CBR.map(([pen,load])=>({pen,load}));
  const line=fitTangent(points.slice(1,3));near(line.slope,1000);near(line.origin,.04);
  const next=fitTangent(points.slice(2,4));near(next.slope,300);near(next.origin,-.1);
  assert.equal(fitTangent([{pen:0,load:1},{pen:1,load:1}]),null);
  assert.equal(fitTangent([{pen:0,load:1},{pen:0,load:2}]),null);
});
test('CBR uses corrected targets, adjacent interpolation and explicit reference pressures', () => {
  const points=HW2_CBR.map(([pen,load])=>({pen,load}));
  const raw=calculateCbrBracket(points[2],points[2],.1,0,1000);near(raw.pressure,60);near(raw.cbr,6);
  const corrected=calculateCbrBracket(points[2],points[3],.1,.04,1000);near(corrected.measuredTarget,.14);near(corrected.fraction,.8);near(corrected.pressure,72);near(corrected.cbr,7.2);
  const second=calculateCbrBracket(points[4],points[5],.2,.04,1500);near(second.pressure,98);near(second.cbr,98/15);
  assert.equal(calculateCbrBracket(points[0],points[1],.1,0,1000),null);
  assert.equal(calculateCbrBracket(points[6],points[7],.2,1,1500),null);
  assert.equal(calculateCbrBracket(points[2],points[3],.1,0,0),null);
  assert.equal(calculateCbrBracket(points[2],points[3],.1,NaN,1000),null);
});
test('editor rejects malformed imports and never treats blanks as zero', () => {
  assert.ok(Number.isNaN(numberOrNaN('')));assert.ok(Number.isNaN(numberOrNaN('  ')));
  assert.deepEqual(parseRows('1,2,3\n4\t5\t6',3).map(r=>r.values),[['1','2','3'],['4','5','6']]);
  assert.throws(()=>parseRows('0,,10',2));
  for(const s of ['1,2','1,2,bad','1,2,Infinity',''])assert.throws(()=>parseRows(s,3));
});

test('normalizing the generalized shear term exposes one continuous power law without changing residuals', () => {
  const fit = fitModulus(observations, 'generalized');
  for (const p of fit.points) {
    const adjustedObserved = shearNormalizedModulus(fit, p.mr, p.sd);
    const adjustedFit = shearNormalizedModulus(fit, p.predicted, p.sd);
    near(adjustedFit, fit.k1 * fit.pa * (p.theta / fit.pa) ** fit.k2);
    near(Math.log(adjustedObserved / adjustedFit), p.logResidual);
  }
  for (const k2 of [0, .7, -0.3]) {
    const f = { ...fit, k2 };
    for (const theta of [100, 500, 1500]) {
      for (const sd of [0, theta / 2, theta]) {
        near(shearNormalizedModulus(f, predict(f, theta, sd), sd), f.k1 * f.pa * (theta / f.pa) ** k2);
      }
    }
  }
});

test('nominal confinement grouping preserves the five test levels and original recorded stresses', () => {
  const counts = new Map();
  for (const p of observations) {
    const level = displayConfinement(p.s3);
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }
  assert.deepEqual([...counts], [[20.68,6],[34.47,6],[68.95,6],[103.42,6],[137.9,6]]);
  assert.equal(observations[9].s3, 104.11);
  assert.equal(displayConfinement(104.11, false), 104.11);
  assert.equal(displayConfinement(104), 104);
});

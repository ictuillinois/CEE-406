import test from 'node:test';
import assert from 'node:assert/strict';
import {ResourceCache} from './engine/geometry/resourceCache.js';

test('cache reuses resources and evicts least-recent unused entries',()=>{
    const disposed=[];const cache=new ResourceCache(2,value=>disposed.push(value));
    const a=cache.acquire('a',()=>({id:'a'})); a.release();
    const b=cache.acquire('b',()=>({id:'b'})); b.release();
    const again=cache.acquire('a',()=>assert.fail('must reuse'));
    assert.equal(again.value,a.value);again.release();
    const c=cache.acquire('c',()=>({id:'c'}));c.release();
    assert.deepEqual(disposed,[b.value]);cache.clear();
    assert.equal(disposed.length,3);
});

test('live/export leases survive eviction and clear, and release only once',()=>{
    const disposed=[];const cache=new ResourceCache(1,value=>disposed.push(value));
    const a=cache.acquire('a',()=>({id:'a'}));
    const exportA=cache.acquire('a',()=>assert.fail('must reuse'));
    const b=cache.acquire('b',()=>({id:'b'}));
    cache.clear();assert.equal(disposed.length,0);
    a.release();a.release();assert.equal(disposed.length,0);
    exportA.release();assert.deepEqual(disposed,[a.value]);
    b.release();assert.deepEqual(disposed,[a.value,b.value]);
    assert.equal(cache.entries.size,0);
});

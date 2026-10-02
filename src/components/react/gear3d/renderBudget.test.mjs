import test from 'node:test';
import assert from 'node:assert/strict';
import {liveRenderRatio,mobileViewport,liveGeometryQuality} from './engine/scene/renderBudget.js';

test('high-density mobile screens stay within settled and moving live pixel budgets',()=>{
    for(const [width,height] of [[390,600],[844,390],[1024,700],[1920,1080],[3840,2160]])for(const dpr of [1,2,3,4])for(const moving of [false,true]) {
        const ratio=liveRenderRatio({width,height,dpr,mobile:true,moving});
        assert.ok(ratio>0 && ratio<=2);
        assert.ok(width*height*ratio*ratio<=(moving?750000:1500000)+1);
        if(moving) assert.ok(ratio<=1.25);
    }
});

test('compact Auto geometry reduces mesh cost without overriding explicit detail',()=>{
    for(const count of [4,6,8]) assert.equal(liveGeometryQuality('auto',count,true),'standard');
    for(const count of [10,18,34]) assert.equal(liveGeometryQuality('auto',count,true),'draft');
    for(const quality of ['draft','standard','high']) assert.equal(liveGeometryQuality(quality,34,true),quality);
    assert.equal(liveGeometryQuality('auto',18,false),'auto');
});

test('desktop tiers retain resolution targets, GPU limits and interaction scaling',()=>{
    assert.equal(liveRenderRatio({width:1200,height:700,targetPx:3840,dpr:1}),3.2);
    assert.equal(liveRenderRatio({width:1200,height:700,targetPx:3840,dpr:1,moving:true}),1.25);
    assert.equal(liveRenderRatio({width:1200,height:700,targetPx:3840,dpr:2,moving:true}),2);
    assert.equal(liveRenderRatio({width:1200,height:700,targetPx:3840,gpuLimit:2400}),2);
    assert.equal(mobileViewport(390,false),true);
    assert.equal(mobileViewport(1000,true),true);
    assert.equal(mobileViewport(1000,false),false);
});

/** Reproduce the 757/767 catalog from reviewed Boeing ACAP dimensions.
 * Imperial drawing dimensions are converted exactly; see the review for pages.
 */
import fs from 'node:fs';
const inch=value=>Math.round(value*25.4*1000)/1000;
const manuals={
    757:'https://www.boeing.com/content/dam/boeing/v2/airports/acaps/757_Rev_H.pdf',
    767:'https://www.boeing.com/content/dam/boeing/v2/airports/acaps/767_REV_K.pdf'
};
// model, MTOW lb, taxi lb, wheelbase in, length in, main/nose psi,
// tail-height range m, weight / dimension / clearance / footprint PDF pages.
const reviewed=[
    ['757-200',255500,256000,720,1863,183,155,[13.49,13.74],[16,20,22,117]],
    ['757-300',270000,271000,880,2143,200,136,[13.56,13.64],[19,21,23,117]],
    ['767-200',315000,317000,775,1910,165,146,[15.60,16.13],[22,28,32,193]],
    ['767-300ER',412000,413000,896,2163,200,172,[15.39,16.03],[25,29,33,194]],
    ['767-400ER',450000,451000,1030,2416,213,170,[16.68,17.01],[27,31,35,195]]
];
// Vertical intersections with the prepared meshes at each gear station,
// rounded slightly into the body so the illustrative struts meet the surface.
const attachments={
    '757-200':{nose:3420,main:3900},'757-300':{nose:3430,main:3910},
    '767-200':{nose:2730,main:3620},'767-300ER':{nose:2240,main:3020},
    '767-400ER':{nose:2670,main:3520}
};
const units=reviewed.map(([model,mtow,taxi,wb,length,mainPsi,nosePsi,height,pages])=>{
    const narrow=model.startsWith('757'),extended=model==='767-400ER';
    const family=narrow?757:767,url=manuals[family];
    const reference=`Boeing D6-${narrow?'58327 Rev H':'58328 Rev K'}, December 2024; PDF pages ${pages.join(', ')} (weights, dimensions, clearances, footprint).`;
    const footprint=`Boeing ${family} ACAP section 7.2, PDF page ${pages[3]}. ${url}`;
    const track=inch(narrow?288:366),pitch=inch(narrow?34:extended?45.8:45);
    const tandem=inch(narrow?45:extended?54:56),wheelbase=inch(wb);
    const mainTire=narrow?'H40x14.5-19':extended?'50x20.0R22':'H46x18.0-20';
    const noseTire=narrow?'H31x13.0-12':'H37x14.0-15';
    const quantity=(value,unit,basis)=>({value,unit,basis});
    return {
        schemaVersion:'1.0',id:'b'+model.toLowerCase(),domain:'aircraft',manufacturer:'Boeing',model,
        gearDesignation:'2D',mtow:quantity(mtow,'lb',reference+' '+url+(model==='757-200'?' Selected 255500 lb option applies below 1500 ft airport altitude (table footnote 1).':'')),
        maxTaxiWeight:quantity(taxi,'lb',reference+' '+url),percentOnMainGear:95,
        wheelbase,mainGearTrack:track,tirePressure:quantity(mainPsi,'psi',footprint),
        assumedFields:['percentOnMainGear','bodyFit.tailHeight (midpoint of published clearance range; illustrative rigid attitude)',
            'bodyFit.attachmentHeights (illustrative mesh attachments)'],
        gears:[{
            id:'NLG',role:'nose',type:'dual',wheelsAcross:2,tandemRows:1,x:0,y:0,
            dualSpacing:inch(narrow?24:25),tandemSpacing:null,tire:noseTire,
            pressure:quantity(nosePsi,'psi',footprint),source:footprint
        },...[-1,1].map(sign=>({
            id:sign<0?'MLG-L':'MLG-R',role:'main',type:'dual',wheelsAcross:2,tandemRows:2,
            x:wheelbase,y:sign*track/2,dualSpacing:pitch,tandemSpacing:tandem,
            tire:mainTire,source:footprint
        }))],
        bodyFit:{length:inch(length),noseOffset:inch(narrow?232:179),
            tailHeight:Math.round((height[0]+height[1])*500),
            attachmentHeights:attachments[model],
            source:reference+' Overall length and nose overhang use imperial general-dimension labels. Tail height is the midpoint of the published clearance range, with zero visual pitch. Strut tops are illustrative mesh attachments. '+url},
        notes:'Dedicated variant airframe from FlightGear/Flightradar24; illustrative geometry, not manufacturer CAD. '+
            'Landing-gear track and spacings use manufacturer footprint dimensions, not rounded FAA outer-width derivations. '+
            'Loads use MTOW with an assumed 95% main-gear split; taxi weight is separate. '+
            (model==='767-300ER'?'The 767-300 mesh represents the ER configuration; engine option detail remains illustrative. ':'')+
            (model==='757-200'?'Selected MTOW option is limited to airports below 1500 ft. ':''),
        sources:[{id:`boeing-${family}-acap`,title:`${family} Airplane Characteristics for Airport Planning`,
            publisher:'Boeing Commercial Airplanes',year:2024,url,note:reference},
            {id:'ac-6g',title:'AC 150/5320-6G, Appendix G, G.1.3',publisher:'U.S. Federal Aviation Administration',
                note:'95% main-gear loading is an assumed pavement-design load split.'}]
    };
});
fs.writeFileSync('public/gear3d/data/aircraft/boeing-757-767.json',JSON.stringify({schemaVersion:'1.0',units},null,2)+'\n');
console.log(`Built ${units.length} Boeing configurations from manufacturer drawings.`);

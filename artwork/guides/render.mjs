// Educational illustrations built from owned AI artwork, never inference evidence.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire(process.env.CLEARCUT_MEDIA_PACKAGE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp=require('sharp');
const image=async(path)=>'data:image/png;base64,'+(await sharp(path).png().toBuffer()).toString('base64');
const shoe=await image('artwork/how-to/subject.webp');
const art={};for(const n of ['people','animals','cars'])art[n]=await image('public/artwork/gallery/'+n+'.webp');
const rect=(x,y,w,h,fill,r=20,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
const txt=(x,y,t,size=24,color='#454545',weight=600)=>`<text x="${x}" y="${y}" font-family="DejaVu Sans,sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${t}</text>`;
const img=(src,x,y,w,h)=>`<image xlink:href="${src}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const badge=(x,y,t)=>rect(x,y,180,40,'#fffffff2',20)+txt(x+18,y+27,t,17,'#1d705b');
const pair=(src,a,b,labels)=>rect(40,46,424,424,'white',24)+rect(496,46,424,424,'white',24)+rect(52,58,400,400,a,17)+rect(508,58,400,400,b,17)+img(src,67,75,370,350)+img(src,523,75,370,350)+txt(252,442,labels[0],18,'#48594d').replace('font-family=','text-anchor="middle" font-family=')+txt(708,442,labels[1],18,'#48594d').replace('font-family=','text-anchor="middle" font-family=');
const scenes={
 transparency:pair(shoe,'url(#checker)','#ffffff',['Transparent PNG','White background'])+txt(40,535,'Same artwork. Two background choices.',23),
 products:rect(52,40,856,470,'white',24)+img(shoe,160,70,640,375)+badge(82,70,'White #FFFFFF')+[0,1,2,3].map((_,i)=>`<circle cx="${380+i*64}" cy="470" r="18" fill="${['#fff','#e4eddf','#f1c6c1','#20372f'][i]}" stroke="#b6c4af" stroke-width="2"/>`).join('')+txt(52,558,'Check the listing rules for your product category.',21),
 portraits:pair(art.people,'#e9ddce','#e4eddf',['Plan your backdrop','Check hair and glasses'])+txt(40,535,'Refine gently around hair, glasses and shoulders.',22),
 animals:pair(art.animals,'#e3e9d9','url(#checker)',['Give your subject space','Check fur and whiskers'])+txt(40,535,'Look closely at fine fur before you save.',23),
 cars:pair(art.cars,'#e3e9e4','#ffffff',['Start with a clear photo','Inspect glass and wheel gaps'])+txt(40,535,'Review reflections, shadows and open spaces.',22),
 passport:rect(48,40,420,490,'white',24)+rect(66,58,384,400,'#f7f7f3',16)+img(art.people,110,74,300,348)+`<path d="M88 100v-20h24m292 0h24v20M88 412v20h24m292 0h24v-20" fill="none" stroke="#1d705b" stroke-width="4"/>`+txt(257,497,'Illustrative portrait',19,'#626b70').replace('font-family=','text-anchor="middle" font-family=')+rect(502,82,410,390,'#fff6e8',24)+`<circle cx="555" cy="143" r="24" fill="#b66c00"/>`+txt(548,152,'!',27,'white')+txt(538,210,'Check first.',32)+txt(538,263,'Use your current',23,'#626b70',400)+txt(538,298,'official instructions.',23,'#626b70',400)+txt(538,354,'Editing may be prohibited.',20,'#8a5700')+txt(538,397,'No acceptance guarantee.',20,'#8a5700')+txt(48,575,'A real plain backdrop may be required instead of an edit.',20),
 signature:rect(70,48,820,420,'#d5c3ad',24)+rect(170,104,620,292,'white',8)+`<text x="480" y="286" text-anchor="middle" font-family="DejaVu Serif,serif" font-size="77" font-style="italic" fill="#27352f" transform="rotate(-5 480 286)">SAMPLE</text>`+`<path d="M277 310q178 22 394-24" stroke="#27352f" stroke-width="3" fill="none"/>`+badge(96,70,'Demo, not a signature')+txt(70,520,'Ink-only transparency is not guaranteed.',26)+txt(70,557,'Inspect the PNG against a dark background.',21,'#626b70',400)
};
const sizes={};
for(const[name,scene]of Object.entries(scenes)){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="960" height="600" viewBox="0 0 960 600"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#f2f6ed"/><stop offset="1" stop-color="#e6eee2"/></linearGradient><pattern id="checker" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="white"/><path d="M0 0h14v14H0zm14 14h14v14H14z" fill="#e6ebe3"/></pattern></defs><rect width="960" height="600" fill="url(#bg)"/>${scene}</svg>`;
 for(const w of [480,960]){const file='public/artwork/guides/'+name+'-'+w+'.webp';await sharp(Buffer.from(svg)).resize(w,Math.round(w*600/960)).webp({quality:77,effort:6}).toFile(file);sizes[file]=readFileSync(file).length;}
}
// Static, native UI workflow: three image cards from the same already-labelled tutorial.
const panels=[];for(const[n,i]of ['upload','edit','download'].map((n,i)=>[n,i]))panels.push({input:await sharp('public/artwork/how-to/'+n+'.webp').resize(288,216).toBuffer(),left:32+i*304,top:62});
const workflow=await sharp({create:{width:960,height:340,channels:3,background:'#f1f5ed'}}).composite(panels).png().toBuffer();
for(const w of [480,960]){const file='public/artwork/guides/workflow-'+w+'.webp';await sharp(workflow).resize(w,Math.round(w*340/960)).webp({quality:79,effort:6}).toFile(file);sizes[file]=readFileSync(file).length;}
writeFileSync('artwork/guides/sizes.json',JSON.stringify(sizes,null,2)+'\n');console.log(JSON.stringify(sizes));

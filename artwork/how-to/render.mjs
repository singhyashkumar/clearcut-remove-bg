// Original illustrative UI cards, not screenshots or measured inference results.
// Run with Sharp in the media tooling environment; no browser is required.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.CLEARCUT_MEDIA_PACKAGE || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/package.json');
const sharp = require('sharp');
const subject = `data:image/png;base64,${(await sharp(readFileSync(new URL('./subject.webp', import.meta.url))).png().toBuffer()).toString('base64')}`;
const rect=(x,y,w,h,fill,rx=16,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${rx}" ${extra}/>`;
const text=(x,y,s,size=22,fill='#454545',weight=600)=>`<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-family="DejaVu Sans,sans-serif" font-weight="${weight}">${s}</text>`;
const shoe=(x,y,w,h)=>`<image xlink:href="${subject}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
const photo=(fill='url(#checker)')=>rect(64,30,512,310,'white',20)+rect(72,38,496,294,fill,14)+shoe(85,49,470,266);
const button=(label,x=172,y=374,w=296)=>rect(x,y,w,66,'#1d705b',33)+text(x+w/2,y+41,label,23,'white',700).replace('font-size=', 'text-anchor="middle" font-size=');
const tools=(selected='Erase')=>['Erase','Restore','Undo'].map((s,i)=>rect(129+i*130,361,118,55,s===selected?'#1d705b':'white',11)+text(188+i*130,396,s,19,s===selected?'white':'#48614c').replace('font-size=','text-anchor="middle" font-size=')).join('');
const pointer=`<path d="m440 406 30 25-14 3-8 14Z" fill="white" stroke="#1d705b" stroke-width="3" stroke-linejoin="round"/>`;
const brush=(x,y,r=26)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#1d705b" stroke-width="5"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="white" stroke-width="2"/>`;
const scenes={
 upload:photo('url(#paper)')+rect(86,54,150,36,'#ffffffee',7)+text(98,78,'my-photo.jpg',16,'#536052',400)+button('Upload Image ↑')+pointer,
 edit:photo()+rect(80,48,150,34,'#ffffffef',7)+text(92,71,'Your cutout',16,'#536052',400)+tools()+brush(445,240),
 download:rect(38,85,564,220,'white',24)+rect(60,108,210,173,'url(#checker)',12)+shoe(66,110,198,163)+text(292,171,'clearcut.png',25)+text(292,204,'PNG · No watermark',16,'#626b70',400)+`<circle cx="562" cy="256" r="20" fill="#e4eddf"/>`+text(550,264,'✓',26,'#1d705b')+button('Download PNG ↓')+pointer,
 refine:photo()+brush(416,244,31)+tools()+text(158,451,'Brush size',16,'#626b70',400)+rect(272,440,145,5,'#c2d1b9',2)+`<circle cx="338" cy="442" r="9" fill="#1d705b" stroke="white" stroke-width="3"/>`+text(440,451,'40',16,'#626b70'),
 background:photo('#e4eddf')+['url(#checker)','#fff','#e4eddf','#f1c6c1','#fff'].map((c,i)=>`<circle cx="${193+i*64}" cy="389" r="22" fill="${c}" stroke="${i===2?'#1d705b':'#cbd7c5'}" stroke-width="${i===2?3:1.5}"/>`).join('')+text(309,398,'✓',26,'#1d705b')+text(440,398,'+',27,'#1d705b')+text(320,451,'Choose your background',17,'#626b70',400).replace('font-size=','text-anchor="middle" font-size='),
 compare:rect(36,67,276,270,'white',18)+rect(328,67,276,270,'white',18)+rect(44,75,260,254,'url(#paper)',12)+rect(336,75,260,254,'url(#checker)',12)+shoe(48,101,252,180)+shoe(340,101,252,180)+text(174,307,'Original',18,'#536052').replace('font-size=','text-anchor="middle" font-size=')+text(466,307,'Result',18,'#536052').replace('font-size=','text-anchor="middle" font-size=')+rect(192,373,126,55,'white',11)+rect(328,373,120,55,'#1d705b',11)+text(214,407,'Original',19)+text(357,407,'Result',19,'white')
};
const sizes={};
for(const [name,scene] of Object.entries(scenes)){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="640" height="480" viewBox="0 0 640 480"><defs><linearGradient id="back" x2="1" y2="1"><stop stop-color="#f3f7ef"/><stop offset="1" stop-color="#e6eee2"/></linearGradient><linearGradient id="paper" x2="1" y2="1"><stop stop-color="#d3bea6"/><stop offset="1" stop-color="#eaddcb"/></linearGradient><pattern id="checker" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#fff"/><path d="M0 0h12v12H0zm12 12h12v12H12z" fill="#e7ebe5"/></pattern></defs><rect width="640" height="480" fill="url(#back)"/>${scene}</svg>`;
 const out=new URL(`../../public/artwork/how-to/${name}.webp`,import.meta.url);
 await sharp(Buffer.from(svg)).webp({quality:83,effort:6}).toFile(fileURLToPath(out));
 sizes[name]=readFileSync(out).length;
}
console.log(JSON.stringify(sizes));

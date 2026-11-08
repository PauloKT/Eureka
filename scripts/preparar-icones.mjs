// Explicitly authorized frame processing; originals are read-only.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const folder=new URL('../apps/mobile/assets/themes/',import.meta.url);
await mkdir(folder,{recursive:true});
for(const [source,name] of [['atomo','physics'],['batimento-cardiaco','health'],['cerebro','brain'],['planta-do-solo','nature'],['robo','technology'],['urano','space']]) {
  const input=join(process.argv[2]??'D:/',`${source}.gif`), meta=await sharp(input,{animated:true}).metadata();
  const {data,info}=await sharp(input,{animated:true}).resize({width:160}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const width=info.width,height=info.pageHeight,pixels=width*height;
  for(let frame=0;frame<meta.pages;frame++) {
    const offset=frame*pixels*4, mask=new Uint8Array(pixels);
    const white=p=>Math.min(data[offset+p*4],data[offset+p*4+1],data[offset+p*4+2])>=245;
    if(name==='technology') {
      // White enclosed details on the robot are part of the drawing.
      const queue=[]; const add=p=>{if(!mask[p]&&white(p)){mask[p]=1;queue.push(p);}};
      for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
      for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
      for(let q=0;q<queue.length;q++){const p=queue[q],x=p%width,y=Math.floor(p/width);if(x)add(p-1);if(x<width-1)add(p+1);if(y)add(p-width);if(y<height-1)add(p+width);}
    } else for(let p=0;p<pixels;p++) if(white(p)) mask[p]=1;
    const original=Buffer.from(data.subarray(offset,offset+pixels*4));
    for(let p=0;p<pixels;p++) {
      const i=offset+p*4;
      if(mask[p]){data[i+3]=0;continue;}
      const x=p%width,y=Math.floor(p/width),neighbors=[];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height)neighbors.push(p+dy*width+dx);
      if(!neighbors.some(n=>mask[n]))continue;
      const darkest=Math.min(...neighbors.filter(n=>!mask[n]).map(n=>Math.min(original[n*4],original[n*4+1],original[n*4+2])));
      const alpha=Math.min(1,(255-Math.min(original[p*4],original[p*4+1],original[p*4+2]))/Math.max(1,255-darkest));
      for(let c=0;c<3;c++)data[i+c]=Math.max(0,Math.min(255,255+(original[p*4+c]-255)/Math.max(alpha,.001)));
      data[i+3]=Math.round(alpha*255);
    }
  }
  const pipeline=()=>sharp(data,{raw:{width,height:info.height,channels:4,pageHeight:height}});
  const target=new URL(`${name}.webp`,folder);
  await pipeline().webp({quality:90,alphaQuality:100,loop:meta.loop,delay:meta.delay}).toFile(fileURLToPath(target));
  await sharp(data.subarray(0,pixels*4),{raw:{width,height,channels:4}}).png().toFile(fileURLToPath(new URL(`${name}.png`,folder)));
  const output=await sharp(fileURLToPath(target),{animated:true}).metadata();
  if(output.pages!==meta.pages||JSON.stringify(output.delay)!==JSON.stringify(meta.delay)||!output.hasAlpha)throw Error(`Animation mismatch: ${name}`);
  console.log(JSON.stringify({name,frames:output.pages,transparent:output.hasAlpha}));
}

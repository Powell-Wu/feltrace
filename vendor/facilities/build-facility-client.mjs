import {build} from 'vite';
import {fileURLToPath} from 'node:url';

/** Bundle the shared modules for a static host without React hydration or runtime dependencies. */
export async function buildFacilityClient(){
  const result=await build({
    configFile:false,
    root:fileURLToPath(new URL('./',import.meta.url)),
    publicDir:false,
    logLevel:'error',
    build:{
      write:false,
      minify:true,
      lib:{entry:fileURLToPath(new URL('./explorer.js',import.meta.url)),name:'FELTraceFacilities',formats:['iife']},
    },
  });
  const chunks=(Array.isArray(result)?result:[result]).flatMap(bundle=>bundle.output).filter(output=>output.type==='chunk');
  if(chunks.length!==1)throw Error('Facility controls must produce one self-contained browser bundle');
  return chunks[0].code;
}

import type { TextDocument, TextNode, TextStyle } from '../model.js';
import { COLORS } from './minimessage.js';
export const LEGACY_PALETTE=Object.values(COLORS);
export function parseLegacy(input:string,prefix:string):TextDocument {
  const nodes:TextNode[]=[];let style:TextStyle={},buffer='',serial=0;
  const flush=()=>{if(buffer){nodes.push({id:`l${serial++}`,type:'group',style:{...style},children:[{id:`l${serial++}`,type:'text',value:buffer}]});buffer='';}};
  const fmt:Record<string,keyof TextStyle>={l:'bold',o:'italic',n:'underlined',m:'strikethrough',k:'obfuscated'};
  for(let i=0;i<input.length;) {
    if(input[i]!==prefix||i+1>=input.length){buffer+=input[i++];continue;}
    const code=input[i+1]!.toLowerCase();
    const native=new RegExp(`^${prefix}x(?:${prefix}[0-9a-f]){6}`,'i').exec(input.slice(i));
    const short=new RegExp(`^${prefix}#[0-9a-f]{6}`,'i').exec(input.slice(i));
    if(native||short){flush();const raw=(native??short)![0];style={color:native?'#'+raw.slice(2).replaceAll(prefix,''):raw.slice(1)};i+=raw.length;continue;}
    if(/[0-9a-f]/.test(code)){flush();style={color:LEGACY_PALETTE[parseInt(code,16)]!};i+=2;continue;}
    if(code==='r'){flush();style={};i+=2;continue;}
    if(fmt[code]){flush();style={...style,[fmt[code]!]:true};i+=2;continue;}
    buffer+=input[i++];
  }
  flush();return {revision:0,nodes};
}

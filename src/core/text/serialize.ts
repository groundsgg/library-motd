import type { Outcome, SerializeOptions, TextDocument, TextNode, TextStyle, TextTarget } from '../model.js';
import { diagnostic } from '../diagnostics.js';
import { flattenText, hex, rgb } from './colors.js';
import { LEGACY_PALETTE } from './legacy.js';
import { encodeProperties } from './properties.js';
import { layoutText } from '../layout/layout.js';
const decorations=['bold','italic','underlined','strikethrough','obfuscated'] as const;
const tags:Record<string,string>={bold:'b',italic:'i',underlined:'u',strikethrough:'st',obfuscated:'obf'};
const esc=(s:string)=>s.replaceAll('\\','\\\\').replaceAll('<','\\<');
export function serializeText(text:TextDocument,target:TextTarget,options:SerializeOptions={}):Outcome<string> {
  if(text.source?.format===target.format&&text.source.revision===text.revision&&!options.layout)return {value:text.source.value,diagnostics:[]};
  const diagnostics=[];
  let opaqueLoss=false;
  const inspect=(nodes:TextNode[])=>{for(const n of nodes){if(n.type==='group')inspect(n.children);if(n.type==='opaque'&&n.format!==target.format)opaqueLoss=true;}};inspect(text.nodes);
  if(opaqueLoss){diagnostics.push(diagnostic('unsupported-export','','Protected constructs cannot be represented in this format',options.lossy==='reduce'?'warning':'error'));if(options.lossy!=='reduce')return {value:null,diagnostics};}
  const mm=(nodes:TextNode[]):string=>nodes.map(n=>{
    if(n.type==='text')return esc(n.value);if(n.type==='newline')return '<newline>';if(n.type==='placeholder')return `{{${n.name}}}`;
    if(n.type==='opaque')return n.format==='minimessage'?n.raw:esc(n.fallback??n.raw);
    const uneven=n.style.gradient?.some((s,i,a)=>Math.abs(s.position-i/(a.length-1))>1e-6);
    if(uneven){const flat=flattenText({revision:0,nodes:[n]});return flat.map(c=>wrap(esc(c.text),{...c.style,color:c.color,gradient:undefined,rainbow:undefined})).join('');}
    return wrap(mm(n.children),n.style);
  }).join('');
  function wrap(value:string,style:TextStyle):string {
    let out=value;
    if(style.color)out=`<${style.color}>${out}</${style.color}>`;
    if(style.gradient)out=`<gradient:${style.gradient.map(s=>s.color).join(':')}>${out}</gradient>`;
    if(style.rainbow)out=`<rainbow:${style.rainbow.reversed?'!':''}${style.rainbow.phase}>${out}</rainbow>`;
    for(const k of decorations)if(style[k]!==undefined)out=`<${style[k]?'':'!'}${tags[k]}>${out}</${tags[k]}>`;
    return out;
  }
  let chars=flattenText(text);
  if(options.layout){const layout=layoutText(text,options.layout);let index=0;chars=chars.flatMap(c=>{if(index===0||chars[index-1]?.text==='\n'){const line=chars.slice(0,index).filter(c=>c.text==='\n').length;const pad=Math.round((layout.lines[line]?.padding??0)/(options.layout!.profile.font.advances[' ']??4));index++;return [...Array.from({length:pad},()=>({...c,text:' ',color:'#ffffff',style:{}})),c];}index++;return [c];});diagnostics.push(...layout.diagnostics);}
  if(target.format==='minimessage') {
    if(!options.layout)return {value:mm(text.nodes),diagnostics};
    return {value:chars.map(c=>c.text==='\n'?'<newline>':wrap(esc(c.text),{...c.style,color:c.color,gradient:undefined,rainbow:undefined})).join(''),diagnostics};
  }
  if(target.format==='json') {
    const extra=chars.map(c=>({text:c.text,color:c.color,...Object.fromEntries(decorations.map(k=>[k,!!c.style[k]]))}));
    return {value:JSON.stringify({text:'',extra}),diagnostics};
  }
  const prefix=target.format==='legacy-ampersand'?'&':'§';let out='',previous='';
  for(const c of chars) {
    const style=c.style,key=c.color+'|'+decorations.map(k=>!!style[k]).join('|');
    if(key!==previous) {
      let color=c.color.toLowerCase(),i=LEGACY_PALETTE.indexOf(color);
      if(i<0&&!target.rgb){if(options.lossy!=='reduce')return {value:null,diagnostics:[...diagnostics,diagnostic('unsupported-color','','Target does not support RGB colors')]};const channels=rgb(color);i=LEGACY_PALETTE.map(v=>rgb(v).reduce((s,n,k)=>s+(n-channels[k]!)**2,0)).reduce((best,d,index,a)=>d<a[best]!?index:best,0);color=LEGACY_PALETTE[i]!;diagnostics.push(diagnostic('reduced-color','','RGB reduced to the closest legacy color','warning'));}
      out+=prefix+'r';
      out+=i>=0?prefix+i.toString(16):target.hex==='adventure'?prefix+color:prefix+'x'+[...color.slice(1)].map(d=>prefix+d).join('');
      const codes=['l','o','n','m','k'];decorations.forEach((k,i)=>{if(style[k])out+=prefix+codes[i];});previous=key;
    }
    out+=c.text;
  }
  return {value:target.format==='properties'?encodeProperties(out,target.encoding==='ascii'):out,diagnostics};
}

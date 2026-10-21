import type { JsonValue, TextDocument, TextNode, TextStyle } from '../model.js';
import { COLORS } from './minimessage.js';
export function parseJsonText(value:JsonValue,maxDepth=128):TextDocument {
  let serial=0; const id=()=>`j${serial++}`;
  const visit=(v:JsonValue,depth=0):TextNode[]=>{
    if(depth>maxDepth)throw new TypeError('Component nesting exceeds limit');
    if(typeof v==='string')return [{id:id(),type:'text',value:v}];
    if(Array.isArray(v)) {
      if(!v.length)return [];
      const first=visit(v[0]!,depth+1);
      // Component-array siblings inherit the first component's style.
      if(first[0]?.type==='group')return [{...first[0],children:[...first[0].children,...v.slice(1).flatMap(v=>visit(v,depth+1))]}];
      return v.flatMap(v=>visit(v,depth+1));
    }
    if(!v||typeof v!=='object')throw new TypeError('Expected text component');
    const allowed=['text','extra','color','bold','italic','underlined','strikethrough','obfuscated'];
    if(Object.keys(v).some(k=>!allowed.includes(k)))return [{id:id(),type:'opaque',format:'json',raw:JSON.stringify(v),fallback:typeof v.text==='string'?v.text:'[unsupported component]'}];
    const style:TextStyle={};
    if(typeof v.color==='string') { const c=COLORS[v.color]??v.color;if(!/^#[\da-f]{6}$/i.test(c))throw new TypeError('Invalid component color');style.color=c; }
    for(const k of ['bold','italic','underlined','strikethrough','obfuscated'] as const)if(v[k]!==undefined){if(typeof v[k]!=='boolean')throw new TypeError('Expected boolean decoration');style[k]=v[k];}
    if(v.text!==undefined&&typeof v.text!=='string')throw new TypeError('Expected component text');
    if(v.extra!==undefined&&!Array.isArray(v.extra))throw new TypeError('Expected extra array');
    const children:TextNode[]=[];
    if(typeof v.text==='string'&&v.text)children.push({id:id(),type:'text',value:v.text});
    if(Array.isArray(v.extra))children.push(...v.extra.flatMap(v=>visit(v,depth+1)));
    return [{id:id(),type:'group',style,children}];
  };
  return {revision:0,nodes:visit(value)};
}

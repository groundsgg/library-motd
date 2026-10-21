import type { GradientStop, TextDocument, TextNode, TextStyle } from '../model.js';
export const rgb = (hex: string): number[] => [1,3,5].map(p=>parseInt(hex.slice(p,p+2),16));
export const hex = (values: number[]): string => '#'+values.map(v=>Math.max(0,Math.min(255,Math.round(v+1e-9))).toString(16).padStart(2,'0')).join('');
export function interpolate(stops: GradientStop[], position: number): string {
  const first=stops[0],last=stops.at(-1); if(!first||!last) return '#ffffff';
  if(position<=first.position) return first.color; if(position>=last.position) return last.color;
  const right=stops.findIndex(s=>s.position>=position),a=stops[right-1]!,b=stops[right]!;
  const from=rgb(a.color),to=rgb(b.color),t=(position-a.position)/(b.position-a.position);
  return hex(from.map((v,i)=>v+(to[i]!-v)*t));
}
export function rainbowColor(position: number): string {
  const h=Math.fround(Math.fround(((position%1)+1)%1)*6), x=Math.fround(Math.fround(1-Math.abs(Math.fround(h%2)-1))*255);
  return hex((h<1?[255,x,0]:h<2?[x,255,0]:h<3?[0,255,x]:h<4?[0,x,255]:h<5?[x,0,255]:[255,0,x]).map(Math.floor));
}
function adventureGradient(stops:GradientStop[],t:number,phase=0):string {
  if(stops.some((s,i)=>Math.abs(s.position-i/(stops.length-1))>1e-6)&&!phase)return interpolate(stops,t);
  const colors=(phase<0?[...stops].reverse():stops).map(s=>s.color);
  const pos=t*(colors.length-1)+(phase<0?1+phase:phase)*(colors.length-1),floor=Math.floor(pos);
  const fraction=Math.fround(Math.fround(pos)-Math.fround(floor));
  const a=rgb(colors[floor%colors.length]!),b=rgb(colors[Math.ceil(pos)%colors.length]!);
  return hex(a.map((v,i)=>Math.fround(v+Math.fround(fraction*(b[i]!-v)))));
}
export interface StyledChar { text: string; color: string; style: TextStyle; nodeId: string; offset: number; position: number; opaque?: TextNode }
const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
export function flattenText(document: TextDocument): StyledChar[] {
  let position=0;
  function walk(nodes: TextNode[], inherited: TextStyle): StyledChar[] {
    const out: StyledChar[]=[];
    for(const node of nodes) {
      if(node.type==='group') {
        const style={...inherited,...node.style},chars=walk(node.children,style);
        const visible=chars.filter(c=>c.text!=='\n');
        if(node.style.gradient||node.style.rainbow) visible.forEach((c,i)=>{
          if(c.style.color!==style.color&&c.style.color!==undefined)return;
          if(c.style.gradient!==style.gradient&&c.style.gradient)return;
          const t=visible.length<=1?0:i/(visible.length-1);
          c.color=node.style.gradient?adventureGradient(node.style.gradient,t,node.style.gradientPhase):rainbowColor(Math.fround((node.style.rainbow!.reversed?visible.length-1-i:i)/visible.length)+(node.style.rainbow!.phase/10));
        });
        out.push(...chars); continue;
      }
      const value=node.type==='text'?node.value:node.type==='newline'?'\n':node.type==='placeholder'?`{{${node.name}}}`:node.fallback??node.raw;
      for(const part of segmenter.segment(value)) {
        out.push({text:part.segment,color:inherited.color??'#aaaaaa',style:{...inherited},nodeId:node.id,offset:part.index,position,...(node.type==='opaque'?{opaque:node}:{})});
        position+=part.segment.length;
      }
    }
    return out;
  }
  return walk(document.nodes,{});
}

import type { ClientProfile } from '../core/model.js';
export function animateObfuscation(root:HTMLElement,profile:ClientProfile,enabled:boolean):()=>void {
  if(!enabled||root.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches)return ()=>{};
  const glyphs=[...root.querySelectorAll<HTMLElement>('[data-obfuscated]')];
  if(!glyphs.length)return ()=>{};
  const groups=new Map<number,string[]>();
  for(const [text,width] of Object.entries(profile.font.advances))if(text.trim()&&text.length===1){const group=groups.get(width)??[];group.push(text);groups.set(width,group);}
  const interval=setInterval(()=>{for(const span of glyphs){const candidates=groups.get(Number(span.dataset.advance));if(candidates?.length)span.textContent=candidates[Math.floor(Math.random()*candidates.length)]!;}},80);
  return ()=>clearInterval(interval);
}

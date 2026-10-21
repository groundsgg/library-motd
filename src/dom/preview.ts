import type { Alignment, Diagnostic, PreviewContext, ServerListDocument, TextDocument, TextStyle } from '../core/model.js';
import { evaluateStatus } from '../core/status/evaluate.js';
import { resolveText } from '../core/text/placeholders.js';
import { parseText } from '../core/text/parse.js';
import { layoutText } from '../core/layout/layout.js';
import { rgb,hex } from '../core/text/colors.js';
import { bindTooltip } from './tooltips.js';
import { animateObfuscation } from './animation.js';
export interface PreviewOptions { document:ServerListDocument; context:PreviewContext; labels?:Readonly<Record<string,string>> }
export interface PreviewHandle { update(options:PreviewOptions):void; destroy():void; getDiagnostics():readonly Diagnostic[] }
export const element=<K extends keyof HTMLElementTagNameMap>(doc:Document,tag:K,className:string,text?:string):HTMLElementTagNameMap[K]=>{const e=doc.createElement(tag);e.className=className;if(text!==undefined)e.textContent=text;return e;};
export function applyTextStyle(span:HTMLElement,style:TextStyle,color?:string):void {
  const fg=color??style.color??'#aaaaaa';span.style.color=fg;span.style.textShadow=`1px 1px 0 ${hex(rgb(fg).map(v=>Math.floor(v/4)))}`;
  span.style.fontWeight=style.bold?'700':'400';span.style.fontStyle=style.italic?'italic':'normal';
  span.style.textDecoration=[style.underlined?'underline':'',style.strikethrough?'line-through':''].filter(Boolean).join(' ');
}
export function renderText(root:HTMLElement,text:TextDocument,context:PreviewContext,width:number,maxLines=2,alignments?:Alignment[]):Diagnostic[] {
  const layout=layoutText(text,{profile:context.profile,width,maxLines,alignments});
  root.style.width=width+'px';root.style.height=Math.min(maxLines,layout.lines.length)*context.profile.font.lineHeight+'px';
  root.setAttribute('aria-label',layout.glyphs.map(g=>g.text).join(''));
  for(const glyph of layout.glyphs){if(glyph.line>=maxLines)continue;const span=element(root.ownerDocument,'span','mcp-glyph',glyph.text);span.style.left=glyph.x+'px';span.style.top=(glyph.line*context.profile.font.lineHeight)+'px';span.style.width=glyph.advance+'px';applyTextStyle(span,glyph.style,glyph.color);if(glyph.style.obfuscated&&glyph.text.trim()){span.dataset.obfuscated='';span.dataset.advance=String(glyph.advance-(glyph.style.bold?1:0));}root.append(span);}
  return layout.diagnostics;
}
export function createPreview(host:HTMLElement,initial:PreviewOptions):PreviewHandle {
  const doc=host.ownerDocument,wrapper=element(doc,'div','mcp-wrap');host.append(wrapper);
  let stop=()=>{},destroyed=false,diagnostics:Diagnostic[]=[];
  function update(options:PreviewOptions):void {
    if(destroyed)return;stop();wrapper.replaceChildren();
    const {document:state,context}=options,labels=options.labels??{};
    const evaluated=evaluateStatus(state,context),status=evaluated.value??context.base;diagnostics=[...evaluated.diagnostics];
    const scale=Math.max(.5,context.guiScale),geometry=context.profile.geometry,width=Math.max(140,Math.min(geometry.rowWidth,context.viewportWidth/scale));
    const stage=element(doc,'div','mcp-stage'),row=element(doc,'div','mcp-row');
    wrapper.style.width=width*scale+'px';wrapper.style.setProperty('--mcp-font',`'${context.profile.font.family}',monospace`);
    stage.style.width=width*scale+'px';stage.style.height=36*scale+'px';row.style.width=width+'px';row.style.transform=`scale(${scale})`;row.role='group';row.setAttribute('aria-label',labels.serverEntry??'Minecraft server entry');stage.append(row);wrapper.append(stage);
    const icon=element(doc,'div','mcp-icon');icon.dataset.field='icon';
    if(status.favicon?.startsWith('data:image/png;base64,')){const image=element(doc,'img','');image.src=status.favicon;image.alt=labels.serverIcon??'Server icon';image.addEventListener('error',()=>{image.remove();icon.textContent='?';});icon.append(image);}else icon.textContent='?';
    row.append(icon,element(doc,'div','mcp-server-name',context.serverName));
    const compatible=(state.version.mode==='always')?false:context.compatible??context.clientProtocol===status.version.protocol;
    const players=element(doc,'button','mcp-players');players.type='button';players.setAttribute('aria-label',compatible?(labels.onlinePlayers??'Online players'):(labels.versionInfo??'Version information'));
    if(compatible)players.textContent=status.players?`${status.players.online}/${status.players.max}`:'???';
    else {players.classList.add('mcp-incompatible');const legacy=parseText(status.version.name,'legacy-section').value; if(legacy){const content=element(doc,'span','mcp-version-text');const size=layoutText(legacy,{profile:context.profile,width:width-42,maxLines:1});const textWidth=size.lines[0]?.width??0;renderText(content,legacy,context,Math.min(width-42,textWidth),1);content.style.display='block';players.append(content);} }
    players.dataset.field='version';row.append(players);
    const ping=element(doc,'button','mcp-ping',compatible?'▂▄▆█':'✕');ping.type='button';ping.setAttribute('aria-label',labels.connectionStatus??'Connection status');if(!compatible)ping.classList.add('mcp-incompatible');row.append(ping);
    const motd=element(doc,'div','mcp-motd');motd.dataset.field='motd';
    const values={...context.values,...(status.players?{players:String(status.players.online),max:String(status.players.max)}:{})};
    const resolved=resolveText(state.motd.text,values);diagnostics.push(...resolved.diagnostics);
    diagnostics.push(...renderText(motd,resolved.value!,context,width-geometry.iconSize-geometry.iconGap-geometry.rightInset,2,state.motd.alignments));row.append(motd);
    if(compatible&&status.players&&status.players.sample.length){const tooltip=element(doc,'div','');const raw=status.players.sample.map(s=>s.name).join('\n');const text=parseText(raw,'legacy-section').value!;const content=element(doc,'div','mcp-tooltip-text');const lineWidth=Math.max(...raw.split('\n').map(l=>l.length*6),40);renderText(content,text,context,lineWidth,30);tooltip.append(content);tooltip.style.setProperty('--mcp-tooltip-scale',String(scale));content.style.zoom=String(scale);bindTooltip(players,tooltip,wrapper);}
    const pingTip=element(doc,'div','',compatible?`${context.pingMs} ms`:(labels.incompatible??'Incompatible version!'));bindTooltip(ping,pingTip,wrapper);
    stop=animateObfuscation(wrapper,context.profile,context.animations);
    if(!context.profile.verified){wrapper.dataset.profileVerified='false';wrapper.title=labels.unverifiedProfile??'Client profile awaiting reference validation';}
  }
  update(initial);
  return {update,destroy(){if(destroyed)return;destroyed=true;stop();wrapper.remove();},getDiagnostics:()=>diagnostics};
}

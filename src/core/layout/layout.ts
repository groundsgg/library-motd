import type { LayoutOptions, LayoutResult, TextDocument } from '../model.js';
import { flattenText } from '../text/colors.js';
import { diagnostic } from '../diagnostics.js';
export function layoutText(text:TextDocument,options:LayoutOptions):LayoutResult {
  const diagnostics:LayoutResult['diagnostics']=[],glyphs:LayoutResult['glyphs']=[],lines:LayoutResult['lines']=[];
  let line=0,x=0;
  const finish=()=>{const align=options.alignments?.[line]??'left',remaining=Math.max(0,options.width-x),space=options.profile.font.advances[' ']??4;const padding=align==='left'?0:Math.round((align==='center'?remaining/2:remaining)/space)*space;lines.push({width:x,padding});for(const g of glyphs)if(g.line===line)g.x+=padding;line++;x=0;};
  for(const c of flattenText(text)) {
    if(c.text==='\n'){finish();continue;}
    const normalized=c.text.normalize('NFC'),font=options.profile.font;
    if(!font.supported(normalized))diagnostics.push(diagnostic('missing-glyph',c.nodeId,`No glyph for ${c.text}`,'warning'));
    const advance=(font.advances[normalized]??font.fallbackAdvance)+(c.style.bold&&c.text!==' '?font.boldOffset:0);
    if(x+advance>options.width&&x>0){diagnostics.push(diagnostic('line-overflow',c.nodeId,'Text wraps beyond the selected row width','warning'));finish();}
    glyphs.push({...c,advance,x,line});x+=advance;
  }
  finish();
  if(lines.length>(options.maxLines??2))diagnostics.push(diagnostic('hidden-lines','motd','Only the first two lines are visible','warning'));
  return {glyphs,lines,diagnostics};
}

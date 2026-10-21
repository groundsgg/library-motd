import type { Diagnostic, Outcome, TextDocument, TextNode } from '../model.js';
import { diagnostic } from '../diagnostics.js';
export function resolveText(text: TextDocument, values: Readonly<Record<string,string>>): Outcome<TextDocument> {
  const diagnostics: Diagnostic[]=[];
  const visit=(nodes:TextNode[]):TextNode[]=>nodes.map(n=>{
    if(n.type==='group') return {...n,children:visit(n.children)};
    if(n.type!=='placeholder') return {...n};
    if(!Object.hasOwn(values,n.name)) { diagnostics.push(diagnostic('unknown-placeholder',n.id,`No value for {{${n.name}}}`,'warning')); return {...n}; }
    return {id:n.id,type:'text',value:values[n.name]!};
  });
  const nodes=visit(text.nodes);
  return {value:{revision:text.revision+1,nodes},diagnostics};
}

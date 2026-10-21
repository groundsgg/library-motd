import { expect,it } from 'vitest';
import { createDocument,parseText,validateDocument } from '../../src/index.js';
it.each(['constructor','__proto__','toString'])('treats prototype names as protected text: %s',tag=>{
 const parsed=parseText(`<${tag}>text</${tag}>`,'minimessage');
 expect(parsed.value?.nodes[0]?.type).toBe('opaque');
 expect(validateDocument(createDocument(parsed.value!)).value).not.toBeNull();
});
it('enforces nesting limits for JSON components too',()=>{
 let component:unknown={text:'x'};for(let i=0;i<129;i++)component={text:'',extra:[component]};
 expect(parseText(JSON.stringify(component),'json',{maxDepth:128}).value).toBeNull();
});

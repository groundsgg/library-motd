import { EditorState, Plugin, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import type { PreviewContext, ServerListDocument, TextDocument, TextFormat, TextStyle } from '../../core/model.js';
import { validateDocument } from '../../core/document.js';
import { parseText } from '../../core/text/parse.js';
import { serializeText } from '../../core/text/serialize.js';
import { createPreview,element,type PreviewHandle } from '../preview.js';
import { editorSchema,type StylePath } from './schema.js';
import { fromEditorNode,nextId,toEditorNode } from './mapping.js';
import { EditorHistory,type HistoryEntry } from './history.js';
export type EditableField='motd'|'version'|'hover';
export type Feature='motd'|'version'|'icon'|'players'|'hover'|'import'|'export';
export interface EditorChange {origin:'visual'|'source'|'import'|'history';changedFields:(keyof Pick<ServerListDocument,'motd'|'version'|'icon'|'players'|'hover'>)[]}
export interface ImportAdapter { (address:string,signal:AbortSignal):Promise<import('../../core/model.js').JavaStatus> }
export interface EditorOptions {document:ServerListDocument;context:PreviewContext;onChange(document:ServerListDocument,change:EditorChange):void;features?:Partial<Record<Feature,boolean>>;labels?:Readonly<Record<string,string>>;readOnly?:boolean;disabled?:boolean;imports?:{adapter:ImportAdapter;timeoutMs?:number}}
export type EditorCommand=
 |{type:'format';style:TextStyle;field?:EditableField}
 |{type:'gradient';stops:import('../../core/model.js').GradientStop[];field?:EditableField}
 |{type:'align';line:number;align:import('../../core/model.js').Alignment}
 |{type:'set-field';field:Feature;value:unknown}
 |{type:'replace-source';source:string;format?:TextFormat;field?:EditableField}
 |{type:'replace-document';document:ServerListDocument;origin?:'import'}
 |{type:'undo'|'redo'};
export interface EditorHandle {update(options:EditorOptions):void;getDocument():ServerListDocument;execute(command:EditorCommand):void;focus(field:EditableField):void;destroy():void}
export interface EditorExtension {root:HTMLElement;getOptions():EditorOptions;getDocument():ServerListDocument;execute(command:EditorCommand):void;onDispose(callback:()=>void):void}
export type EditorExtensionFactory=(editor:EditorExtension)=>void;
const extensions:EditorExtensionFactory[]=[];
/** Register optional UI additions before constructing an editor. Kept internal to the DOM bundle. */
export function registerEditorExtension(factory:EditorExtensionFactory):void {extensions.push(factory);}

export function createEditor(host:HTMLElement,initial:EditorOptions):EditorHandle {
  let options=initial,current=structuredClone(initial.document),destroyed=false,preview:PreviewHandle|undefined;
  let activeField:EditableField='motd',sourceMode=false;
  const doc=host.ownerDocument,root=element(doc,'section','mce-root'),history=new EditorHistory(),views=new Map<EditableField,EditorView>();
  const dispose: (()=>void)[]=[];let errors:string[]=[];
  host.append(root);
  const label=(key:string,fallback:string)=>options.labels?.[key]??fallback;
  const enabled=(feature:Feature)=>options.features?.[feature]!==false;
  const locked=()=>!!options.readOnly||!!options.disabled;
  const textFor=(field:EditableField):TextDocument=>field==='motd'?current.motd.text:field==='version'&&current.version.mode!=='automatic'?current.version.text:field==='hover'&&current.hover.mode==='custom'?current.hover.text:{revision:0,nodes:[]};
  const setText=(state:ServerListDocument,field:EditableField,text:TextDocument)=>{if(field==='motd')state.motd.text=text;else if(field==='version')state.version={mode:state.version.mode==='automatic'?'always':state.version.mode,text};else state.hover={mode:'custom',text};};
  const snapshot=():HistoryEntry=>{const v=views.get(activeField);return {document:structuredClone(current),...(v?{selection:{field:activeField,from:v.state.selection.from,to:v.state.selection.to}}:{})};};
  function showErrors():void {const output=root.querySelector<HTMLElement>('.mce-diagnostics');if(output){output.textContent=errors.join('\n');output.hidden=!errors.length;}}
  function commit(next:ServerListDocument,origin:EditorChange['origin'],field:Feature,typing=false,before?:HistoryEntry):boolean {
    const valid=validateDocument(next);if(!valid.value){errors=valid.diagnostics.map(d=>d.message);showErrors();return false;}
    history.record(before??snapshot(),typing);current=valid.value;errors=[];showErrors();
    options.onChange(structuredClone(current),{origin,changedFields:[field as EditorChange['changedFields'][number]]});return true;
  }
  function button(parent:HTMLElement,text:string,name:string,action:()=>void,disabled=locked()):HTMLButtonElement {
    const b=element(doc,'button','mce-button',text);b.type='button';b.setAttribute('aria-label',name);b.title=name;b.disabled=disabled;
    b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',action);parent.append(b);return b;
  }
  function mount(field:EditableField,target:HTMLElement):void {
    target.replaceChildren();target.dataset.editorField=field;target.classList.add('mce-inline');
    const schema=editorSchema(doc,options.context.values);
    const state=EditorState.create({schema,doc:toEditorNode(textFor(field),schema),plugins:[
      new Plugin({filterTransaction(tr,state){return !tr.docChanged||tr.doc.childCount<=Math.max(2,state.doc.childCount);}}),
      keymap({'Mod-z':()=>{execute({type:'undo'});return true;},'Mod-y':()=>{execute({type:'redo'});return true;},'Mod-Shift-z':()=>{execute({type:'redo'});return true;}}),keymap(baseKeymap),
    ]});
    const view=new EditorView(target,{state,editable:()=>!locked()&&enabled(field),attributes:{'aria-label':label(field,field==='motd'?'MOTD inline editor':field==='version'?'Version inline editor':'Hover inline editor'),role:'textbox','aria-multiline':String(field!=='version')},
      handleDOMEvents:{focus(){activeField=field;return false;}},
      handlePaste(view,event){const plain=event.clipboardData?.getData('text/plain');if(plain!==undefined){view.dispatch(view.state.tr.insertText(plain));return true;}return false;},
      dispatchTransaction(tr){
        if(destroyed)return;const before=snapshot();view.updateState(view.state.apply(tr));
        if(tr.docChanged){const next=structuredClone(current);setText(next,field,fromEditorNode(view.state.doc,textFor(field)));commit(next,'visual',field,!tr.storedMarksSet,before);}
      },
    });views.set(field,view);
  }
  function rebuild(selection?:HistoryEntry['selection']):void {
    for(const v of views.values())v.destroy();views.clear();preview?.destroy();for(const fn of dispose.splice(0))fn();root.replaceChildren();
    const tabs=element(doc,'div','mce-tabs');root.append(tabs);
    button(tabs,label('visual','Visual'),'Visual',()=>{sourceMode=false;rebuild();},false);
    button(tabs,label('source','Source'),'Source',()=>{sourceMode=true;rebuild();},false);
    const toolbar=element(doc,'div','mce-toolbar');toolbar.role='toolbar';toolbar.setAttribute('aria-label',label('formatting','Text formatting'));root.append(toolbar);
    for(const [key,text,name] of [['bold','B','Bold'],['italic','I','Italic'],['underlined','U','Underline'],['strikethrough','S','Strikethrough'],['obfuscated','K','Obfuscation']] as const)button(toolbar,text,label(key,name),()=>{
      const v=views.get(activeField);const m=v?.state.doc.resolve(v.state.selection.from).marks().find(m=>m.type.name==='format');const effective=Object.assign({},...(m?.attrs.path??[]).map((p:StylePath)=>p.style));execute({type:'format',style:{[key]:!effective[key]}});
    });
    const color=element(doc,'input','mce-color');color.type='color';color.value='#ffaa00';color.setAttribute('aria-label',label('color','Text color'));color.disabled=locked();color.addEventListener('input',()=>execute({type:'format',style:{color:color.value}}));toolbar.append(color);
    button(toolbar,'↶',label('undo','Undo'),()=>execute({type:'undo'}));button(toolbar,'↷',label('redo','Redo'),()=>execute({type:'redo'}));
    const canvas=element(doc,'div','mce-canvas');root.append(canvas);preview=createPreview(canvas,{document:current,context:options.context,labels:options.labels});
    if(enabled('motd'))mount('motd',canvas.querySelector<HTMLElement>('[data-field=motd]')!);
    if(enabled('version')&&current.version.mode!=='automatic') {
      const old=canvas.querySelector<HTMLElement>('[data-field=version]')!,replacement=element(doc,'div','mcp-players mcp-incompatible');old.replaceWith(replacement);mount('version',replacement);
    }
    if(enabled('hover')&&current.hover.mode==='custom'){const hover=element(doc,'div','mce-hover-editor');root.append(hover);const text=element(doc,'div','');hover.append(text);mount('hover',text);}
    const source=element(doc,'textarea','mce-source');source.setAttribute('aria-label',label('motdSource','MOTD source'));source.spellcheck=false;source.rows=4;source.value=serializeText(current.motd.text,{format:'minimessage',rgb:true}).value??current.motd.text.source?.value??'';source.disabled=locked();source.hidden=!sourceMode;source.addEventListener('input',()=>{
      const parsed=parseText(source.value,'minimessage');if(!parsed.value){errors=parsed.diagnostics.map(d=>d.message);showErrors();return;}
      const next=structuredClone(current);next.motd.text=parsed.value;if(commit(next,'source','motd',true)){const v=views.get('motd');if(v)v.updateState(EditorState.create({schema:v.state.schema,doc:toEditorNode(parsed.value,v.state.schema),plugins:v.state.plugins}));}
    });root.append(source);
    const diagnostics=element(doc,'div','mce-diagnostics');diagnostics.role='status';root.append(diagnostics);showErrors();
    for(const factory of extensions)factory({root,getOptions:()=>options,getDocument:()=>structuredClone(current),execute,onDispose:fn=>dispose.push(fn)});
    if(selection){const v=views.get(selection.field as EditableField);if(v){const limit=v.state.doc.content.size;v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc,Math.max(1,Math.min(selection.from,limit-1)),Math.max(1,Math.min(selection.to,limit-1)))));v.focus();}}
  }
  function execute(command:EditorCommand):void {
    if(destroyed||locked())return;
    if(command.type==='replace-document'){if(command.origin==='import'&&!enabled('import'))return;if(commit(command.document,command.origin??'visual','motd'))rebuild();return;}
    if(command.type==='undo'||command.type==='redo'){
      const entry=command.type==='undo'?history.undo(snapshot()):history.redo(snapshot());if(entry){current=entry.document;rebuild(entry.selection);options.onChange(structuredClone(current),{origin:'history',changedFields:['motd','version','icon','players','hover']});}return;
    }
    const field='field'in command?command.field??activeField:activeField;if(!enabled(field as Feature))return;
    if(command.type==='format'||command.type==='gradient'){
      const v=views.get(field as EditableField);if(!v)return;const {from,to}=v.state.selection;
      const style=command.type==='gradient'?{gradient:command.stops}:command.style,tr=v.state.tr,id=nextId();
      const mark=(path:StylePath[],leafId?:string)=>v.state.schema.marks.format!.create({path:command.type==='gradient'?[{id,style},...path.map(p=>{const {color,gradient,gradientPhase,rainbow,...rest}=p.style;return {...p,style:rest};})]:[...path,{id,style}],leafId});
      if(from===to){const existing=v.state.storedMarks??v.state.selection.$from.marks(),old=existing.find(m=>m.type.name==='format');tr.setStoredMarks([mark(old?.attrs.path??[],old?.attrs.leafId)]);v.dispatch(tr);v.focus();return;}
      v.state.doc.nodesBetween(from,to,(node,pos)=>{if(!node.isText)return;const old=node.marks.find(m=>m.type.name==='format');tr.addMark(Math.max(from,pos),Math.min(to,pos+node.nodeSize),mark(old?.attrs.path??[],old?.attrs.leafId));});v.dispatch(tr);v.focus();return;
    }
    const next=structuredClone(current);
    if(command.type==='align')next.motd.alignments[command.line]=command.align;
    else if(command.type==='replace-source'){const parsed=parseText(command.source,command.format??'minimessage');if(!parsed.value){errors=parsed.diagnostics.map(d=>d.message);showErrors();return;}setText(next,field as EditableField,parsed.value);}
    else if(command.type==='set-field'&&['motd','version','icon','players','hover'].includes(command.field))Object.assign(next,{[command.field]:command.value});
    if(commit(next,'visual',command.type==='align'?'motd':field as Feature))rebuild();
  }
  rebuild();
  return {execute,getDocument:()=>structuredClone(current),focus(field){activeField=field;views.get(field)?.focus();},update(next){if(destroyed)return;options=next;if(JSON.stringify(next.document)!==JSON.stringify(current)){current=structuredClone(next.document);history.clear();}rebuild();},destroy(){if(destroyed)return;destroyed=true;for(const v of views.values())v.destroy();preview?.destroy();for(const fn of dispose.splice(0))fn();root.remove();}};
}

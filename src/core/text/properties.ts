export function decodeProperties(input:string):string {
  const value=input.replace(/^\s*motd\s*[=:]\s*/,'').replace(/\\\r?\n[ \t\f]*/g,'').replace(/^[ \t\f]+/,'');
  return value.replace(/\\(u[\da-fA-F]{4}|.)/gs,(_,c:string)=>c.startsWith('u')?String.fromCharCode(parseInt(c.slice(1),16)):({n:'\n',r:'\r',t:'\t',f:'\f'}[c]??c));
}
export function encodeProperties(value:string,ascii=false):string {
  let out=value.replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll('\r','\\r').replaceAll('\t','\\t');
  if(out.startsWith(' '))out='\\'+out;
  if(ascii)out=out.replace(/[^\x20-\x7e]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  return out;
}

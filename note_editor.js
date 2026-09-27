// Keep notes editable without allowing imported or pasted HTML to run code.
const noteEditor=(()=>{
 const editor=document.getElementById('noteText');
 const toolbar=document.getElementById('noteToolbar');
 let colorInteracting=false;
 function hideToolbar(){toolbar.hidden=true}
 document.addEventListener('pointerdown',event=>{if(!toolbar.contains(event.target)&&!editor.contains(event.target)){colorInteracting=false;hideToolbar()}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')hideToolbar()});
 const allowed=new Set(['P','DIV','BR','STRONG','EM','U','S','SPAN']);
 const discard=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM','INPUT','BUTTON','IMG','VIDEO','AUDIO']);
 function safeColor(value){
  if(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value))return value;
  if(/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value))return value;
  return '';
 }
 function cleanNode(source,documentForOutput){
  if(source.nodeType===Node.TEXT_NODE)return documentForOutput.createTextNode(source.textContent);
  if(source.nodeType!==Node.ELEMENT_NODE||discard.has(source.tagName))return documentForOutput.createDocumentFragment();
  const tag=source.tagName==='B'?'STRONG':source.tagName==='I'?'EM':source.tagName==='STRIKE'?'S':source.tagName==='FONT'?'SPAN':['H1','H2','H3','LI','BLOCKQUOTE'].includes(source.tagName)?'DIV':source.tagName;
  const output=allowed.has(tag)?documentForOutput.createElement(tag.toLowerCase()):documentForOutput.createDocumentFragment();
  if(tag==='SPAN'&&output.nodeType===Node.ELEMENT_NODE){const color=safeColor(source.style.color||source.getAttribute('color')||'');if(color)output.style.color=color}
  for(const child of source.childNodes)output.append(cleanNode(child,documentForOutput));
  return output;
 }
 function sanitize(html){
  const parsed=new DOMParser().parseFromString(String(html),'text/html');
  const clean=document.createElement('div');
  for(const child of parsed.body.childNodes)clean.append(cleanNode(child,document));
  return clean.innerHTML;
 }
 let savedRange=null;
 function positionToolbar(range){
  const rect=range.getBoundingClientRect();
  toolbar.hidden=false;
  const width=toolbar.offsetWidth,height=toolbar.offsetHeight;
  const left=Math.max(8,Math.min(innerWidth-width-8,rect.left+(rect.width-width)/2));
  const top=rect.top-height-8>=8?rect.top-height-8:Math.min(innerHeight-height-8,rect.bottom+8);
  toolbar.style.left=`${left}px`;toolbar.style.top=`${Math.max(8,top)}px`;
 }
 function updateSelection(){
  if(window.__viewerReadOnlyReport){hideToolbar();return}
  const selection=getSelection();
  if(selection?.rangeCount&&!selection.isCollapsed&&editor.contains(selection.anchorNode)&&editor.contains(selection.focusNode)){
   savedRange=selection.getRangeAt(0).cloneRange();positionToolbar(savedRange);
  }else if(!colorInteracting)hideToolbar();
 }
 document.addEventListener('selectionchange',updateSelection);
 editor.addEventListener('pointerup',updateSelection);
 editor.addEventListener('keyup',updateSelection);
 addEventListener('resize',()=>{if(!toolbar.hidden&&savedRange)positionToolbar(savedRange)});
 editor.addEventListener('scroll',()=>{if(!toolbar.hidden&&savedRange)positionToolbar(savedRange)});
 function restoreSelection(){editor.focus();if(savedRange&&editor.contains(savedRange.commonAncestorContainer)){const selection=getSelection();selection.removeAllRanges();selection.addRange(savedRange)}}
 function command(name,value){if(window.__viewerReadOnlyReport)return;restoreSelection();document.execCommand(name,false,value);updateSelection()}
 document.querySelectorAll('[data-note-command]').forEach(button=>{
  button.addEventListener('mousedown',event=>event.preventDefault());
  button.addEventListener('click',()=>command(button.dataset.noteCommand));
 });
 const colorPicker=document.getElementById('noteColor');
 colorPicker.addEventListener('pointerdown',()=>{colorInteracting=true});
 colorPicker.addEventListener('change',event=>{command('foreColor',event.target.value);colorInteracting=false;updateSelection()});
 editor.addEventListener('paste',event=>{
  if(window.__viewerReadOnlyReport){event.preventDefault();return}
  event.preventDefault();restoreSelection();
  const html=event.clipboardData.getData('text/html');
  if(html)document.execCommand('insertHTML',false,sanitize(html));
  else document.execCommand('insertText',false,event.clipboardData.getData('text/plain'));
 });
 editor.addEventListener('drop',event=>event.preventDefault());
 return{
  hideToolbar,
  getHtml(){return sanitize(editor.innerHTML)},
  setHtml(html){editor.innerHTML=sanitize(html||'');savedRange=null;hideToolbar()},
  setPlainText(text){editor.textContent=String(text||'');savedRange=null;hideToolbar()},
  clear(){editor.replaceChildren();savedRange=null;hideToolbar()}
 };
})();

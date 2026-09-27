// Release display metadata; chart behavior does not depend on this version.
const APP_META=Object.freeze({name:'ColourSpace Profile Viewer',label:'v1.5.7 © 2026 WhARTS Ltd.'});
document.title=APP_META.name;
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('appTitle').textContent=APP_META.name;
  document.getElementById('appSubtitle').textContent=APP_META.label;
});

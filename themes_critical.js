if (window._tkCritical) {} else {
(function() {
'use strict';
window._tkCritical = true;

// ── Default (Roblox varsayılanı) modu: Tracked teması kapalıyken hiçbir kritik stil/GL
//    patch uygulama → tam yüklemede de saf Roblox (FOUC yok). Flag'i themes_content yazar. ──
try { if (localStorage.getItem('tk_theme_off') === '1') return; } catch(_) {}

// ── WebGL clearColor patch (MAIN world, document_start) ──────
// Intercepts WebGLRenderingContext.prototype.clearColor before Three.js
// creates any context. On profile/avatar pages forces alpha=0 so the canvas
// background is transparent and the wallpaper shows through.
try {
  function _tkPatchGLProto(proto) {
    if (!proto || proto._tkGLPatched) return;
    proto._tkGLPatched = true;

    const origClearColor = proto.clearColor;
    const origClear      = proto.clear;

    // Patch clearColor — handles renderers that do a prototype lookup each call.
    proto.clearColor = function(r, g, b, a) {
      if (/\/users\/\d+\/profile|\/my\/avatar/.test(location.pathname)) {
        return origClearColor.call(this, 0, 0, 0, 0);
      }
      return origClearColor.call(this, r, g, b, a);
    };

    // Patch clear — the actual flush operation.
    // Three.js often pre-binds clearColor at renderer creation, bypassing the
    // prototype patch above. By intercepting clear() we call the stored NATIVE
    // origClearColor immediately before every color-buffer clear, so the cached
    // binding Three.js holds is irrelevant — state is forced transparent here.
    // 0x4000 = COLOR_BUFFER_BIT
    proto.clear = function(mask) {
      if ((mask & 0x4000) && /\/users\/\d+\/profile|\/my\/avatar/.test(location.pathname)) {
        origClearColor.call(this, 0, 0, 0, 0);
      }
      return origClear.call(this, mask);
    };
  }

  _tkPatchGLProto(WebGLRenderingContext.prototype);
  if (typeof WebGL2RenderingContext !== 'undefined') _tkPatchGLProto(WebGL2RenderingContext.prototype);
} catch(_) {}

const P = {
  default:  [[230,15,9],[230,18,6],[220,70,58],[245,240,232]],
  midnight: [[230,20,8],[230,25,5],[220,75,58],[245,240,232]],
  cream:    [[38,15,10],[38,18,7],[38,60,55],[247,242,233]],
  ember:    [[18,25,8],[18,30,5],[22,80,55],[246,237,224]],
  slate:    [[210,12,10],[210,14,7],[210,55,58],[238,242,246]],
  forest:   [[148,20,8],[148,25,5],[148,55,45],[232,240,232]],
  plum:     [[278,22,9],[278,28,6],[278,65,58],[240,232,245]],
};

function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}

function hslAdj(base,d){
  return[
    ((base[0]+(d.hue||0))%360+360)%360,
    clamp(base[1]+(d.sat||0),0,100),
    clamp(base[2]+(d.light||0),0,100),
  ];
}

function hexToHSL(hex){
  const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;
  if(d===0)return[0,0,l*100];
  const s=d/(1-Math.abs(2*l-1));
  let h=0;
  if(mx===r)h=((g-b)/d+6)%6;
  else if(mx===g)h=(b-r)/d+2;
  else h=(r-g)/d+4;
  return[h*60,s*100,l*100];
}

try{
  const key=localStorage.getItem('tk_theme')||'midnight';
  const d=JSON.parse(localStorage.getItem('tk_adj')||'{}');
  const ca=localStorage.getItem('tk_custom_accent')||'';
  const p=P[key]||P.midnight;

  const tb=hslAdj(p[0],d),sb=hslAdj(p[1],d);
  let ac;
  if(ca&&/^#[0-9a-f]{6}$/i.test(ca)){ac=hexToHSL(ca);}
  else{ac=hslAdj(p[2],d);}
  // (--tk-fg/fgOpacity kaldırıldı — hiçbir CSS kuralı tüketmiyordu)
  const f=v=>v.toFixed(1);
  const vars=[
    `--tk-topbar:hsl(${f(tb[0])},${f(tb[1])}%,${f(tb[2])}%)`,
    `--tk-sidebar:hsl(${f(sb[0])},${f(sb[1])}%,${f(sb[2])}%)`,
    `--tk-card:hsla(${f(ac[0])},${f(ac[1])}%,${f(ac[2])}%,0.12)`,
    `--tk-navitem:hsla(${f(ac[0])},${f(ac[1])}%,${f(ac[2])}%,0.05)`,
    `--tk-accent:hsla(${f(ac[0])},${f(ac[1])}%,${f(ac[2])}%,0.10)`,
  ].join(';');

  const css=`:root{${vars}}`+
    `.rbx-header,#header,[class*="rbx-header"],.rbx-navbar,nav.rbx-navbar{background-color:var(--tk-topbar)!important}`+
    `.left-nav,[class*="bg-surface-0"]{background-color:var(--tk-sidebar)!important}`+
    `.left-nav [class*="bg-shift-100"]{background-color:var(--tk-navitem)!important}`+
    `.game-card-thumb-container,[class*="thumbnail-2d-container"]{background-color:var(--tk-card)!important}`;

  const el=document.createElement('style');
  el.id='tracked-critical-theme';
  el.textContent=css;
  (document.head||document.documentElement).appendChild(el);
}catch(_){}

})();
}

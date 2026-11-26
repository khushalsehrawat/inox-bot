
(function(){
var rm=matchMedia('(prefers-reduced-motion:reduce)').matches,$=function(s,r){return(r||document).querySelector(s)},$$=function(s,r){return[].slice.call((r||document).querySelectorAll(s))};
// hex lattice
function hexes(svg,w,h,r,cls){var ns='http://www.w3.org/2000/svg',dx=r*1.732,dy=r*1.5,o='';
for(var y=0,j=0;y<h+r;y+=dy,j++)for(var x=(j%2)*dx/2;x<w+dx;x+=dx){var p=[];for(var k=0;k<6;k++){var a=Math.PI/180*(60*k-30);p.push((x+r*.96*Math.cos(a)).toFixed(1)+','+(y+r*.96*Math.sin(a)).toFixed(1))}
o+='<polygon points="'+p.join(' ')+'" style="stroke:currentColor;fill:none;stroke-width:1;opacity:.5"/>'}
svg.innerHTML=o}
var lat=$('#lat');lat.setAttribute('viewBox','0 0 1440 900');
(function(){var ns='http://www.w3.org/2000/svg',r=46,dx=r*1.732,dy=r*1.5,j=0,n=0;
for(var y=0;y<900+r;y+=dy,j++)for(var x=(j%2)*dx/2;x<1440+dx;x+=dx){var p=[];for(var k=0;k<6;k++){var a=Math.PI/180*(60*k-30);p.push((x+r*.96*Math.cos(a)).toFixed(1)+','+(y+r*.96*Math.sin(a)).toFixed(1))}
var e=document.createElementNS(ns,'polygon');e.setAttribute('points',p.join(' '));var d=Math.hypot(x-1100,y-250)/1400;e.style.transitionDelay=(d*2.4)+'s';lat.appendChild(e);n++}
requestAnimationFrame(function(){setTimeout(function(){$$('polygon',lat).forEach(function(e,i){e.style.opacity=(.1+((i*7)%5)*.07)})},rm?0:200)})})();
['hx2','hx3'].forEach(function(id){var s=document.getElementById(id);s.style.color=id=='hx2'?'#77685D':'#B9AA9C';hexes(s,400,400,34)});
// header
var hd=$('#hd');function sc(){hd.classList.toggle('s',scrollY>60);
var rv=$('.rev'),b=rv.getBoundingClientRect(),p=Math.min(1,Math.max(0,-b.top/(b.height-innerHeight)));rv.style.setProperty('--p',rm?1:p.toFixed(3));
$$('.lab').forEach(function(l){l.classList.toggle('on',rm||p>=parseFloat(l.dataset.at))});
var t=$('.bl h2 span');if(t&&!rm){var q=$('.bl').getBoundingClientRect();t.style.transform='translateX('+(q.top*.06).toFixed(1)+'px)'}}
addEventListener('scroll',sc,{passive:true});sc();
$('#mb').onclick=function(){var o=hd.classList.toggle('o');this.setAttribute('aria-expanded',o)};
$$('#nv a').forEach(function(a){a.onclick=function(){hd.classList.remove('o');$('#mb').setAttribute('aria-expanded',false)}});
// reveals
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');e.target.classList.remove('hid');io.unobserve(e.target)}})},{threshold:.2});
$$('.adv li,.ag .hid').forEach(function(e,i){e.style.transitionDelay=(i%4*90)+'ms';io.observe(e)});
// magnetic CTAs
if(matchMedia('(hover:hover) and (pointer:fine)').matches&&!rm)$$('.mag').forEach(function(b){b.addEventListener('pointermove',function(e){var r=b.getBoundingClientRect();b.style.transform='translate('+((e.clientX-r.left-r.width/2)*.12).toFixed(1)+'px,'+((e.clientY-r.top-r.height/2)*.2).toFixed(1)+'px)'});b.addEventListener('pointerleave',function(){b.style.transform=''})});
// cabinet focus
var nm={shutter:'Shutter',carcass:'Carcass',core:'Aluminium Honeycomb Core'};
function foc(k){$$('[data-k]').forEach(function(b){b.setAttribute('aria-pressed',b.dataset.k===k)});$('#dgl').textContent=nm[k]}
$$('[data-k]').forEach(function(b){b.onclick=function(){foc(b.dataset.k)};b.onmouseenter=function(){if(b.classList.contains('hs'))foc(b.dataset.k)}});
// finishes
$$('.fs button').forEach(function(b){b.onclick=function(){$$('.fs button').forEach(function(x){x.setAttribute('aria-pressed',x===b)});$('#mm').textContent=b.dataset.m+' selected as a starting direction. Mention it in your enquiry; INOX will confirm available finishes.'}});
$$('[data-app]').forEach(function(a){a.addEventListener('click',function(){$('#app').value=a.dataset.app})});
// form
var f=$('#f'),m=$('#fm');
f.addEventListener('submit',function(e){e.preventDefault();var d=new FormData(f),ph=(d.get('phone')||'').trim(),em=(d.get('email')||'').trim();
if(d.get('website'))return;
if(!(d.get('name')||'').trim()){m.textContent='Enter your full name.';f.elements.namedItem("name").focus();return}
if(!ph&&!em){m.textContent='Enter a phone number or an email address.';f.elements.namedItem("phone").focus();return}
if(ph&&!/^[+0-9\s()-]{7,20}$/.test(ph)){m.textContent='Enter a valid phone number.';f.elements.namedItem("phone").focus();return}
if(em&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){m.textContent='Enter a valid email address.';f.elements.namedItem("email").focus();return}
if(!f.consent.checked){m.textContent='Please tick the consent box.';return}
var ep=f.dataset.endpoint;
if(ep){fetch(ep,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(d))}).then(function(r){m.textContent=r.ok?'Enquiry sent. INOX will be in touch.':'Could not send. Please call +91 11 46467755 or email info@inoxdecor.com.'}).catch(function(){m.textContent='Could not send. Please call +91 11 46467755 or email info@inoxdecor.com.'});return}
var body=['Name: '+d.get('name'),'Phone: '+ph,'Email: '+em,'Customer type: '+d.get('type'),'Application: '+d.get('app'),'Location: '+d.get('loc'),'',d.get('msg')].join('\n');
m.textContent='No enquiry server is configured yet. Your email app will open with this enquiry ready to send to info@inoxdecor.com.';
location.href='mailto:info@inoxdecor.com?subject='+encodeURIComponent('Consultation request – INOX Aluminium Honeycomb')+'&body='+encodeURIComponent(body)});
})();

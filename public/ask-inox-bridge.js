(() => {
  // Preserve the standalone honeycomb page and its animations. The React widget lives in a same-origin frame.
  fetch('/api/ask-inox',{cache:'no-store'}).then(r=>r.json()).then(({enabled})=>{
    if(!enabled)return;
    const frame=document.createElement('iframe');
    frame.src='/ask-inox-widget';frame.title='Ask INOX product guide';frame.allow='microphone; autoplay';
    frame.style.cssText='position:fixed;border:0;background:transparent;z-index:1000;visibility:hidden;color-scheme:light;';
    let open=false;
    const resize=()=>{
      const mobile=innerWidth<=600;
      frame.style.width=open?(mobile?'100%':'410px'):'200px';
      frame.style.height=open?(mobile?'90dvh':`${Math.min(820,innerHeight-130)}px`):'56px';
      frame.style.right=mobile?(open?'0':'16px'):'30px';
      frame.style.bottom=mobile?(open?'0':'calc(82px + env(safe-area-inset-bottom))'):'112px';
    };
    window.addEventListener('message',event=>{if(event.origin!==location.origin || event.source!==frame.contentWindow || event.data?.type!=='inox-ask-widget')return;open=event.data.open===true;resize();frame.style.visibility='visible';});
    window.addEventListener('resize',resize);resize();document.body.append(frame);
  }).catch(()=>{});
})();

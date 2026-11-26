"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, Mic, MicOff, PhoneOff, Send, Volume2, X, MessageCircle, Package } from "lucide-react";
import type { AskLookup, AskMessage, AskProduct } from "@/lib/ask-inox-core";
import { AddToEnquiry } from "./catalogue-browser";
import { ProductPrice, useCustomer } from "./customer-account";
import "./ask-inox.css";
import type { GeminiVoice } from "./ask-inox-gemini";
import { isSafePublicNavigation, type NavigationTarget } from "@/lib/ask-inox-navigation";

type Message = AskMessage & {id:string};
type VoiceState = "idle"|"connecting"|"listening"|"thinking"|"speaking";
type Mode = "gemini"|"openai";

function ProductCard({product,request}:{product:AskProduct;request:(action:string,body?:Record<string,unknown>)=>Promise<Record<string,unknown>>}) {
  const [chosen,setChosen]=useState("");
  const [error,setError]=useState("");
  const variation=product.variations?.find(v=>v.id===chosen);
  const preview=variation || product.variations?.find(v=>product.matchedVariationIds.includes(v.id)) || product.variations?.[0];
  const specs={...product.specifications,...preview?.specifications,...Object.fromEntries(Object.entries({Dimensions:preview?.dimensions,Size:preview?.size,Finish:preview?.finish,Colour:preview?.colour,Material:preview?.material}).filter(([,v])=>v))};
  const image=preview?.images[0] || product.image;
  return <article className="ask-product">
    <div className="ask-product-top">{image?<img src={image} alt={product.name} loading="lazy"/>:<Package size={32} aria-hidden="true"/>}<div><h3>{product.name}</h3><span>{variation?"SKU":"Preview SKU"}: {preview?.sku || product.sku || "Choose a variant"}</span></div></div>
    <dl>{Object.entries(specs).slice(0,6).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value || "Not specified"}</dd></div>)}</dl>
    {!!product.variations?.length && <label>Confirm your variant<select aria-label={`Variant for ${product.name}`} value={chosen} onChange={e=>{setChosen(e.target.value);setError("");}}><option value="">Select a variant…</option>{product.variations.map(v=><option key={v.id} value={v.id}>{v.sku} · {[v.dimensions || v.size,v.finish,v.colour].filter(Boolean).join(" / ") || v.name}{!v.available?" · unavailable":""}{product.matchedVariationIds.includes(v.id)?" · SKU match":""}</option>)}</select></label>}
    {product.variations && product.variations.length>1 && <details><summary>Compare published variants</summary><div className="ask-comparison"><table><thead><tr><th>SKU</th><th>Dimensions / size</th><th>Finish / colour</th><th>Material</th></tr></thead><tbody>{product.variations.map(v=><tr key={v.id}><td>{v.sku}</td><td>{v.dimensions || v.size || "Not specified"}</td><td>{[v.finish,v.colour].filter(Boolean).join(" / ") || "Not specified"}</td><td>{v.material || "Not specified"}</td></tr>)}</tbody></table></div></details>}
    {variation && <ProductPrice id={product.id} variationId={variation.id}/>}
    <div className="ask-product-actions"><Link href={`${product.href}${chosen?`?variation=${encodeURIComponent(chosen)}`:""}`}>View Details</Link>{variation?.available ? <AddToEnquiry key={variation.id} product={product} variationId={variation.id} beforeAdd={async()=>{try{await request("validate",{productId:product.id,variationId:variation.id});setError("");return true;}catch(e){setError(e instanceof Error?e.message:"Please try again.");return false;}}}/> : <span>{variation?"Ask INOX about availability":"Select a variant to add"}</span>}</div>
    {error && <p role="alert">{error}</p>}
  </article>;
}

export function AskInox({embedded=false}:{embedded?:boolean}) {
  const pathname=usePathname();
  const router=useRouter();
  const [open,setOpen]=useState(false),[ready,setReady]=useState(false);
  const [mode,setMode]=useState<Mode>("gemini"),[liveAvailable,setLiveAvailable]=useState(false),[geminiAvailable,setGeminiAvailable]=useState(false);
  const [messages,setMessages]=useState<Message[]>([]),[input,setInput]=useState(""),[busy,setBusy]=useState(false);
  const [lookup,setLookup]=useState<AskLookup|null>(null),[notice,setNotice]=useState("");
  const [navigationChoices,setNavigationChoices]=useState<NavigationTarget[]>([]);
  const [voice,setVoice]=useState<VoiceState>("idle"),[muted,setMuted]=useState(false),[caption,setCaption]=useState("");
  const panel=useRef<HTMLElement>(null),feed=useRef<HTMLDivElement>(null),launcher=useRef<HTMLButtonElement>(null);
  const stream=useRef<MediaStream|null>(null),peer=useRef<RTCPeerConnection|null>(null),channel=useRef<RTCDataChannel|null>(null),audio=useRef<HTMLAudioElement|null>(null);
  const gemini=useRef<GeminiVoice|null>(null),geminiStop=useRef<(()=>void)|null>(null);
  const generation=useRef(0),voiceTimer=useRef<ReturnType<typeof setTimeout>|null>(null),connectionTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const pathRef=useRef(pathname),voiceRef=useRef(voice),modeRef=useRef(mode),busyRef=useRef(false),openRef=useRef(false);
  const {user}=useCustomer();
  const account=useRef(user?.id);
  pathRef.current=embedded?"/honeycomb":pathname;voiceRef.current=voice;modeRef.current=mode;openRef.current=open;
  const request=useCallback(async(action:string,body:Record<string,unknown>={})=>{
    const response=await fetch("/api/ask-inox",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,path:pathRef.current+(pathRef.current.startsWith("/products/")?window.location.search:""),...body}),signal:AbortSignal.timeout(40000)});
    const data=await response.json();
    // An old cleanup request can finish after a fresh Start response in React Strict Mode.
    // Only an active conversation request may expire the current UI session.
    if(response.status===401 && ["chat","lookup","navigate","voice","gemini","validate"].includes(action))setReady(false);
    if(!response.ok)throw new Error(data.message || "Connection unavailable. Please try again.");
    return data;
  },[]);
  const append=useCallback((role:AskMessage["role"],text:string,id=crypto.randomUUID())=>{
    setMessages(previous=>{const exists=previous.some(m=>m.id===id);return (exists?previous.map(m=>m.id===id?{...m,text}:m):[...previous,{role,text,id}]).slice(-32);});
  },[]);
  const applyNavigation=useCallback((result:Record<string,unknown>)=>{
    if(result.navigationRequest!==true)return;
    const choices=Array.isArray(result.navigationChoices)?result.navigationChoices:[];
    setNavigationChoices(choices.filter((c):c is NavigationTarget=>c && typeof c.label==="string" && isSafePublicNavigation(c.href)));
    if(typeof result.answer==="string")setNotice(result.answer);
    const destination=result.navigation as NavigationTarget|undefined;
    if(!destination || !isSafePublicNavigation(destination.href))return;
    // No model-supplied URLs reach the router: these are resolved and revalidated by our server.
    if(embedded){if(window.top)window.top.location.href=destination.href;}
    else if(destination.href==="/honeycomb")window.location.assign(destination.href);
    else router.push(destination.href);
  },[router,embedded]);
  const cleanup=useCallback((notify=true)=>{
    generation.current++;
    if(voiceTimer.current)clearTimeout(voiceTimer.current);
    if(connectionTimer.current)clearTimeout(connectionTimer.current);
    stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
    geminiStop.current?.();geminiStop.current=null;gemini.current=null;
    channel.current?.close();channel.current=null;
    if(peer.current){peer.current.onconnectionstatechange=null;peer.current.close();peer.current=null;}
    if(audio.current){audio.current.pause();audio.current.srcObject=null;audio.current=null;}
    
    setVoice("idle");setMuted(false);setCaption("");
    if(notify)void request("end").catch(()=>{});
  },[request]);
  const close=useCallback(()=>{cleanup();setOpen(false);try{sessionStorage.removeItem("inox-ask-open");}catch{}launcher.current?.focus();},[cleanup]);
  useEffect(()=>()=>cleanup(),[cleanup]);
  useEffect(()=>{const end=()=>cleanup();window.addEventListener("pagehide",end);return()=>window.removeEventListener("pagehide",end);},[cleanup]);
  useEffect(()=>{if(open){panel.current?.focus();feed.current?.scrollTo({top:feed.current.scrollHeight});}},[open]);
  useEffect(()=>{if(!open)return;const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.preventDefault();event.stopPropagation();close();}};window.addEventListener("keydown",escape,true);return()=>window.removeEventListener("keydown",escape,true);},[open,close]);
  useEffect(()=>{
    const container=feed.current,last=container?.querySelector<HTMLElement>(".ask-message:last-child");
    if(container && last)container.scrollTo({top:last.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop-12,behavior:"instant"});
  },[messages,lookup]);
  useEffect(()=>{
    if(embedded){document.documentElement.style.background="transparent";document.body.style.background="transparent";window.parent.postMessage({type:"inox-ask-widget",open},window.location.origin);}
    if(open)try{sessionStorage.setItem("inox-ask-open","1");}catch{}
  },[open,embedded]);
  const restored=useRef(false);
  useEffect(()=>{if(restored.current)return;restored.current=true;try{if(sessionStorage.getItem("inox-ask-open")==="1"){setOpen(true);void initialize();}}catch{}},[]);
  useEffect(()=>{if(account.current!==user?.id){account.current=user?.id;cleanup();setMessages([]);setLookup(null);setReady(false);void request("reset").catch(()=>{});}},[user?.id,cleanup,request]);
  async function initialize(){
    try{const data=await request("start");setMode(data.mode);setLiveAvailable(data.liveAvailable);setGeminiAvailable(data.geminiAvailable);setMessages((data.history as AskMessage[]).map((m,i)=>({...m,id:`restored-${i}`})));setLookup(data.lookup || null);setReady(true);setNotice("");}
    catch(e){setNotice(e instanceof Error?e.message:"Unable to connect.");}
  }
  async function launch(){setOpen(true);if(!ready)await initialize();}
  async function send(text:string){
    if(!text.trim() || busyRef.current || !ready)return;
    append("user",text);setInput("");setNotice("");
    if(modeRef.current==="gemini" && gemini.current){gemini.current.sendText(text);void request("remember",{text}).catch(()=>{});return;}
    if(modeRef.current==="openai" && channel.current?.readyState==="open"){
      if(voiceRef.current==="speaking"){channel.current.send(JSON.stringify({type:"response.cancel"}));channel.current.send(JSON.stringify({type:"output_audio_buffer.clear"}));}
      channel.current.send(JSON.stringify({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text}]}}));
      channel.current.send(JSON.stringify({type:"response.create",response:{tool_choice:"required"}}));
      void request("remember",{text}).catch(()=>{});return;
    }
    busyRef.current=true;setBusy(true);
    const token=generation.current;
    try{const data=await request("chat",{text});if(!openRef.current || token!==generation.current)return;if(!data.navigationRequest){setLookup(data as unknown as AskLookup);setNavigationChoices([]);}append("assistant",data.answer);applyNavigation(data);if(data.mode==="catalogue")setNotice("Catalogue text mode. The selected live provider is not configured.");}
    catch(e){if(openRef.current)setNotice(e instanceof Error?e.message:"Unable to connect. Please retry.");}
    finally{busyRef.current=false;setBusy(false);}
  }
  async function event(data:MessageEvent,token:number){
    if(generation.current!==token)return;
    try{
      const e=JSON.parse(data.data);
      if(e.type==="input_audio_buffer.speech_started"){setVoice("listening");setCaption("Listening…");}
      if(e.type==="input_audio_buffer.speech_stopped")setVoice("thinking");
      if(e.type==="conversation.item.input_audio_transcription.delta")setCaption(c=>c==="Listening…"?e.delta:c+e.delta);
      if(e.type==="conversation.item.input_audio_transcription.completed"){append("user",e.transcript,e.item_id);void request("remember",{text:e.transcript}).catch(()=>{});}
      if(e.type==="response.output_audio_transcript.delta" || e.type==="response.output_text.delta") {setVoice("speaking");setCaption(c=>e.delta?c+e.delta:c);}
      if(e.type==="response.created")setCaption("");
      if(e.type==="response.output_audio_transcript.done" || e.type==="response.output_text.done"){append("assistant",e.transcript || e.text,e.item_id);void request("remember",{role:"assistant",text:e.transcript || e.text}).catch(()=>{});}
      if(e.type==="output_audio_buffer.stopped")setVoice("listening");
      if(e.type==="response.function_call_arguments.done"){
        if(e.name!=="search_catalogue" && e.name!=="navigate_site")throw new Error("Unknown assistant request.");
        const args=JSON.parse(e.arguments);setVoice("thinking");
        let output;
        try{output=e.name==="navigate_site"?await request("navigate",{destination:args.destination}):await request("lookup",{query:args.query});if(generation.current!==token)return;if(e.name==="navigate_site")applyNavigation(output);else{setLookup(output as unknown as AskLookup);setNavigationChoices([]);}}
        catch{output={products:[],sources:[],notice:"Catalogue lookup failed. No product facts are verified. Offer contact or enquiry and ask the visitor to retry."};}
        if(generation.current!==token || channel.current?.readyState!=="open")return;
        channel.current.send(JSON.stringify({type:"conversation.item.create",item:{type:"function_call_output",call_id:e.call_id,output:JSON.stringify(output)}}));
        channel.current.send(JSON.stringify({type:"response.create",response:{tool_choice:"none"}}));
      }
      if(e.type==="error"){setNotice("The voice service could not complete that turn. Try again or use text.");setVoice("listening");}
    }catch{/* Malformed upstream events are ignored; never logged. */}
  }
  async function startVoice(){
    cleanup();const token=generation.current;setNotice("");setVoice("connecting");
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone access is unsupported here. Use text chat on this browser.");
      const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1},video:false});
      if(token!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current=media;
      media.getAudioTracks().forEach(t=>{t.onended=()=>{if(generation.current===token){cleanup();setNotice("Microphone disconnected. Text chat remains available.");}};});
      if(modeRef.current==="gemini"){
        connectionTimer.current=setTimeout(()=>{if(token===generation.current){cleanup();setNotice("Gemini connection timed out. Use text or retry voice.");}},35000);
        const {connectGemini}=await import("./ask-inox-gemini");
        if(token!==generation.current)return;
        const connection=await connectGemini({stream:media,request,current:()=>generation.current===token,
          state:value=>{if(generation.current===token)setVoice(value);},caption:setCaption,message:append,lookup:setLookup,navigate:applyNavigation,
          own:stop=>{geminiStop.current=stop;},disconnected:()=>{if(generation.current===token){cleanup();setNotice("Gemini Live disconnected. Text chat remains available; start voice to reconnect.");}},
        });
        if(token!==generation.current){connection.close();return;}
        gemini.current=connection;if(connectionTimer.current)clearTimeout(connectionTimer.current);
        voiceTimer.current=setTimeout(()=>{cleanup();setNotice("Gemini voice time limit reached. Continue in text or reconnect.");},connection.seconds*1000);return;
      }
      if(!window.RTCPeerConnection)throw new Error("Voice is unsupported in this browser. Text chat remains available.");
      const pc=new RTCPeerConnection();peer.current=pc;
      const player=new Audio();player.autoplay=true;audio.current=player;
      pc.ontrack=e=>{if(token!==generation.current)return;player.srcObject=e.streams[0];void player.play().catch(()=>setNotice("Tap the speaker control to enable voice playback."));};
      media.getTracks().forEach(t=>pc.addTrack(t,media));
      const dc=pc.createDataChannel("oai-events");channel.current=dc;
      dc.onmessage=e=>{void event(e,token);};
      dc.onopen=()=>{if(token===generation.current){if(connectionTimer.current)clearTimeout(connectionTimer.current);setVoice("listening");setCaption("Listening…");}};
      pc.onconnectionstatechange=()=>{if(token!==generation.current)return;if(pc.connectionState==="failed" || pc.connectionState==="disconnected"){cleanup();setNotice("Voice disconnected. Text chat is ready; start voice again to reconnect.");}};
      connectionTimer.current=setTimeout(()=>{if(token===generation.current){cleanup();setNotice("Voice connection timed out. Use text or start voice again.");}},30000);
      await pc.setLocalDescription(await pc.createOffer());
      const answer=await request("voice",{sdp:pc.localDescription?.sdp});
      if(token!==generation.current){void request("end").catch(()=>{});return;}
      await pc.setRemoteDescription({type:"answer",sdp:answer.sdp});
      voiceTimer.current=setTimeout(()=>{cleanup();setNotice("Voice time limit reached. Continue in text or start another call.");},answer.seconds*1000);
    }catch(e){
      if(token!==generation.current)return;
      cleanup();setNotice(e instanceof DOMException && ["NotAllowedError","SecurityError"].includes(e.name)?"Microphone permission was denied. You can keep chatting with text, or allow the microphone in your browser and retry.":e instanceof Error?e.message:"Voice connection failed. Text chat remains available.");
    }
  }
  async function changeMode(value:Mode){
    cleanup();setReady(false);
    try{await request("mode",{mode:value});setMode(value);setNotice(value==="gemini"?(geminiAvailable?"Gemini Live selected. Start voice to connect.":"Set GEMINI_API_KEY on the server to enable Gemini Live."):(liveAvailable?"OpenAI Realtime selected. Start voice to connect.":"Set OPENAI_API_KEY on the server to enable OpenAI."));setReady(true);}
    catch(e){setNotice(e instanceof Error?e.message:"Unable to change mode.");setReady(true);}
  }
  const states:Record<VoiceState,string>={idle:"Text chat ready",connecting:"Connecting…",listening:muted?"Microphone muted":"Listening",thinking:"Checking the catalogue…",speaking:"Speaking · you can interrupt"};
  return <div className={embedded?`ask-embedded ${open?"is-open":""}`:undefined} onClickCapture={e=>{
    if(!embedded)return;
    const link=(e.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
    if(link && link.target!=="_blank" && link.origin===window.location.origin){e.preventDefault();if(window.top)window.top.location.href=link.href;}
  }}>
    <button ref={launcher} className="ask-launcher" aria-label="Talk to INOX" aria-expanded={open} aria-controls="ask-inox-panel" onClick={()=>open?close():void launch()}><AudioLines size={21}/><span>Talk to INOX</span></button>
    {open && <section ref={panel} tabIndex={-1} id="ask-inox-panel" className="ask-panel" role="dialog" aria-label="Ask INOX product specialist" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();close();}}}>
      <header className="ask-header"><div className="ask-avatar"><AudioLines size={24}/></div><div><h2>Ask INOX</h2><p>Considered advice. The right details.</p></div><button className="ask-icon" aria-label="Close Ask INOX" onClick={close}><X size={20}/></button></header>
      <div className="ask-status"><span data-state={voice}>{states[voice]}</span><span>{mode==="gemini"?"Gemini Live":"OpenAI Realtime"}</span></div>
      {<label className="ask-mode">Voice provider<select aria-label="Voice provider" value={mode} disabled={!ready || busy} onChange={e=>void changeMode(e.target.value as Mode)}><option value="gemini">Gemini Live · default live provider</option><option value="openai">OpenAI Realtime · WebRTC</option></select></label>}
      <div className="ask-feed" ref={feed}>
        {!messages.length && <div className="ask-welcome"><MessageCircle size={26}/><h3>A little guidance,<br/>for every detail.</h3><p>Tell me what you’re planning. Ask in English, हिन्दी or Hinglish.</p><p>I’m an AI product guide. I’ll check published INOX information before suggesting a product.</p></div>}
        <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text">{messages.map(m=><div key={m.id} className={`ask-message ask-${m.role}`}><span>{m.role==="user"?"You":"Ask INOX"}</span><p>{m.text}</p></div>)}</div>
        {busy && <p className="ask-working" role="status">Checking published information…</p>}
        {navigationChoices.length>0 && <div className="ask-navigation-choices" role="group" aria-label="Choose a destination">{navigationChoices.map(choice=><button key={choice.href} disabled={busy} onClick={async()=>{try{const result=await request("navigate",{destination:choice.href});append("assistant",result.answer);applyNavigation(result);}catch(error){setNotice(error instanceof Error?error.message:"Please try again.");}}}>Open {choice.label}</button>)}</div>}
        {lookup && <div className="ask-results">{lookup.products.map(p=><ProductCard key={`${p.id}-${p.variations?.map(v=>v.id).join()}`} product={p} request={request}/>)}{lookup.clarification && <p className="ask-fit-note">Fit needs confirmation: internal clear opening or external cabinet width, plus usable depth and height.</p>}{lookup.sources.length>0 && <details className="ask-sources"><summary>Published sources</summary>{lookup.sources.map((s,i)=><div key={`${s.href}-${i}`}><a href={s.href} target={s.page?"_blank":undefined} rel="noopener noreferrer">{s.title}{s.page?` · page ${s.page}`:""}</a><p>{s.text}</p></div>)}</details>}</div>}
        {notice && <p className="ask-notice" role="status">{notice}</p>}
      </div>
      {caption && <div className="ask-caption" aria-label="Live captions"><span>Live captions</span><p aria-live="off">{caption}</p></div>}
      <div className="ask-voice-controls">{voice==="idle"?<button disabled={!ready} onClick={()=>void startVoice()}><Mic size={17}/>{mode==="gemini"?"Start Gemini Live":"Start OpenAI Realtime"}</button>:<><button className="ask-icon" aria-label={muted?"Unmute microphone":"Mute microphone"} aria-pressed={muted} onClick={()=>{stream.current?.getAudioTracks().forEach(t=>{t.enabled=muted;});gemini.current?.mute(!muted);setMuted(!muted);}}>{muted?<MicOff size={18}/>:<Mic size={18}/>}</button><button aria-label="End call" onClick={()=>{cleanup();setNotice("Call ended. Your microphone is off. You can continue in text.");}}><PhoneOff size={17}/>End call</button><button className="ask-icon" aria-label="Stop speaking" onClick={()=>{gemini.current?.interrupt();if(channel.current?.readyState==="open"){channel.current.send(JSON.stringify({type:"response.cancel"}));channel.current.send(JSON.stringify({type:"output_audio_buffer.clear"}));}void audio.current?.play().catch(()=>{});setVoice("listening");}}><Volume2 size={18}/></button></>}</div>
      <form className="ask-compose" onSubmit={e=>{e.preventDefault();void send(input);}}><label className="sr-only" htmlFor="ask-input">Message Ask INOX</label><input id="ask-input" value={input} onChange={e=>setInput(e.target.value)} maxLength={1200} placeholder="A product, a SKU, a question…" autoComplete="off" disabled={!ready}/><button className="ask-icon" disabled={!ready || busy || !input.trim()} aria-label="Send message"><Send size={19}/></button></form>
      <footer className="ask-footer"><Link href="/enquiry">Review enquiry</Link><Link href="/contact">Contact INOX</Link><button disabled={busy} onClick={async()=>{cleanup();await request("reset").catch(()=>{});setMessages([]);setLookup(null);setNavigationChoices([]);setReady(false);await initialize();}}>Clear chat</button></footer>
      {!ready && <button className="ask-retry" onClick={()=>{cleanup();void initialize();}}>Connect text chat</button>}
    </section>}
  </div>;
}

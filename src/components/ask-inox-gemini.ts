import type { LiveServerMessage } from "@google/genai";
import type { AskLookup } from "@/lib/ask-inox-core";

export type GeminiVoice = {close:()=>void;mute:(value:boolean)=>void;sendText:(text:string)=>void;interrupt:()=>void;seconds:number};
type Options = {
  stream:MediaStream;
  request:(action:string,body?:Record<string,unknown>)=>Promise<Record<string,unknown>>;
  current:()=>boolean;
  state:(value:"listening"|"thinking"|"speaking")=>void;
  caption:(text:string)=>void;
  message:(role:"user"|"assistant",text:string,id:string)=>void;
  lookup:(value:AskLookup)=>void;
  navigate:(value:Record<string,unknown>)=>void;
  disconnected:()=>void;
  own:(close:()=>void)=>void;
};
export async function connectGemini(o:Options):Promise<GeminiVoice> {
  type Connection={close:()=>void;sendRealtimeInput:(body:Record<string,unknown>)=>void;sendToolResponse:(body:Record<string,unknown>)=>void;sendClientContent:(body:Record<string,unknown>)=>void};
  let closed=false,session:Connection|undefined,socket:WebSocket|undefined;
  // Create/resume audio contexts while the Start voice user gesture is active.
  const input=new AudioContext({sampleRate:16000}),output=new AudioContext({sampleRate:24000});
  let capture:AudioWorkletNode|undefined,player:AudioWorkletNode|undefined,source:MediaStreamAudioSourceNode|undefined;
  let turnId=crypto.randomUUID(),inputText="",outputText="",turnComplete=false,drained=true,muted=false,suppressed=false,grounded=false;
  const canceledCalls=new Set<string>();
  const close=()=>{
    if(closed)return;closed=true;
    socket?.close();capture?.disconnect();player?.disconnect();source?.disconnect();
    void input.close().catch(()=>{});void output.close().catch(()=>{});
  };
  const active=()=>!closed && o.current();
  o.own(close);
  const interrupt=()=>{player?.port.postMessage("flush");drained=true;suppressed=true;outputText="";o.caption("");o.state("listening");};
  async function onmessage(event:LiveServerMessage) {
    if(!active())return;
    for(const id of event.toolCallCancellation?.ids || [])canceledCalls.add(id);
    const content=event.serverContent;
    if(content?.interrupted){interrupt();suppressed=false;grounded=false;}
    if(content?.inputTranscription?.text){
      suppressed=false;
      inputText+=content.inputTranscription.text;o.message("user",inputText,`${turnId}-user`);o.caption(inputText);o.state("listening");
    }
    if(content?.outputTranscription?.text && grounded){outputText+=content.outputTranscription.text;o.message("assistant",outputText,`${turnId}-assistant`);o.caption(outputText);}
    for(const part of content?.modelTurn?.parts || []){
      if(grounded && !suppressed && part.inlineData?.data && part.inlineData.mimeType?.startsWith("audio/pcm")){
        const binary=atob(part.inlineData.data),bytes=new Uint8Array(binary.length);
        for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
        player?.port.postMessage(bytes.buffer,[bytes.buffer]);drained=false;turnComplete=false;o.state("speaking");
      }
    }
    if(event.toolCall?.functionCalls?.length){
      o.state("thinking");
      for(const call of event.toolCall.functionCalls.slice(0,2)){
        let result:Record<string,unknown>;
        try{
          if(call.name==="navigate_site" && typeof call.args?.destination==="string")result=await o.request("navigate",{destination:call.args.destination});
          else if(call.name==="search_catalogue" && typeof call.args?.query==="string")result=await o.request("lookup",{query:call.args.query});
          else throw new Error("Invalid assistant request.");
          if(!active())return;if(canceledCalls.has(call.id || ""))continue;
          grounded=true;if(call.name==="navigate_site")o.navigate(result);else o.lookup(result as unknown as AskLookup);
        }catch{result={products:[],sources:[],notice:"Lookup failed. No product facts are verified. Ask the visitor to retry or contact INOX."};}
        if(active() && !canceledCalls.has(call.id || ""))session?.sendToolResponse({functionResponses:[{id:call.id,name:call.name,response:result}]});
      }
    }
    if(content?.turnComplete){
      if(inputText)void o.request("remember",{text:inputText}).catch(()=>{});
      if(outputText && grounded)void o.request("remember",{role:"assistant",text:outputText}).catch(()=>{});
      if(!grounded)o.message("assistant","Please repeat the question or type it so I can check the INOX website and catalogue.",`${turnId}-assistant`);
      grounded=false;inputText="";outputText="";turnId=crypto.randomUUID();turnComplete=true;if(drained)o.state("listening");
    }
  }
  try{
    // Fetch the single-use credential while audio initializes, rather than afterwards.
    const [token]=await Promise.all([
      o.request("gemini"),
      input.resume(),output.resume(),
      input.audioWorklet.addModule("/ask-inox-audio-worklet.js"),
      output.audioWorklet.addModule("/ask-inox-audio-worklet.js"),
    ]);
    if(!active()){close();throw new Error("Call ended.");}
    capture=new AudioWorkletNode(input,"inox-capture");player=new AudioWorkletNode(output,"inox-playback");player.connect(output.destination);
    player.port.onmessage=e=>{if(e.data==="drained"){drained=true;if(turnComplete && active())o.state("listening");}};
    if(!active()){close();throw new Error("Call ended.");}
    // Own the socket before setup completes, so Close can cancel even a stalled handshake.
    // Only the single-use ephemeral token crosses this browser boundary.
    socket=new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(String(token.token))}`);
    const send=(body:Record<string,unknown>)=>{if(!active() || socket?.readyState!==WebSocket.OPEN)return;socket.send(JSON.stringify(body));};
    session={close:()=>socket?.close(),sendRealtimeInput:body=>send({realtimeInput:body}),sendToolResponse:body=>send({toolResponse:body}),sendClientContent:body=>send({clientContent:body})};
    await new Promise<void>((resolve,reject)=>{
      socket!.onopen=()=>send({setup:{model:`models/${String(token.model).replace(/^models\//,"")}`,generationConfig:{responseModalities:["AUDIO"]}}});
      socket!.onmessage=event=>{
        void (async()=>{
          const text=typeof event.data==="string"?event.data:await (event.data as Blob).text();
          const message=JSON.parse(text) as LiveServerMessage & {error?:unknown};
          if(message.error)throw new Error("Gemini connection rejected.");
          if(message.setupComplete)resolve();
          else await onmessage(message);
        })().catch(()=>{reject(new Error("Gemini voice message failed."));if(active())o.disconnected();});
      };
      socket!.onerror=()=>{reject(new Error("Gemini voice connection failed."));if(active())o.disconnected();};
      socket!.onclose=()=>{reject(new Error("Gemini voice connection closed."));if(active())o.disconnected();};
    });
    if(!active()){close();throw new Error("Call ended.");}
    source=input.createMediaStreamSource(o.stream);source.connect(capture);capture.connect(input.destination);
    capture.port.onmessage=e=>{
      if(!active() || muted)return;
      const bytes=new Uint8Array(e.data);let binary="";for(const b of bytes)binary+=String.fromCharCode(b);
      try{session?.sendRealtimeInput({audio:{data:btoa(binary),mimeType:`audio/pcm;rate=${input.sampleRate}`}});}catch{if(active())o.disconnected();}
    };
    o.state("listening");o.caption("Listening…");
    return {close,seconds:Number(token.seconds),mute:value=>{muted=value;capture?.port.postMessage(value?"mute":"unmute");if(value)session?.sendRealtimeInput({audioStreamEnd:true});},sendText:text=>{interrupt();suppressed=false;session?.sendClientContent({turns:[{role:"user",parts:[{text}]}],turnComplete:true});},interrupt};
  }catch(error){close();throw error;}
}

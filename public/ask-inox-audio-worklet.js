// In-memory PCM only. No recording, storage or network calls in this worklet.
class InoxCapture extends AudioWorkletProcessor {
  constructor() { super(); this.samples=new Int16Array(320);this.offset=0;this.enabled=true;this.port.onmessage=e=>{this.enabled=e.data!=="mute";this.offset=0;}; }
  process(inputs) {
    const input=inputs[0]?.[0];
    if(input && this.enabled)for(const sample of input){this.samples[this.offset++]=Math.round(Math.max(-1,Math.min(1,sample))*32767);if(this.offset===this.samples.length){const bytes=this.samples.buffer.slice(0);this.port.postMessage(bytes,[bytes]);this.offset=0;}}
    return true;
  }
}
class InoxPlayback extends AudioWorkletProcessor {
  constructor() {
    super();this.buffer=new Float32Array(24000*120);this.read=0;this.write=0;this.count=0;this.hadAudio=false;
    this.port.onmessage=e=>{
      if(e.data==="flush"){this.read=this.write;this.count=0;this.hadAudio=false;return;}
      const data=new DataView(e.data);
      for(let i=0;i+1<data.byteLength;i+=2){this.buffer[this.write]=data.getInt16(i,true)/32768;this.write=(this.write+1)%this.buffer.length;if(this.count<this.buffer.length)this.count++;else this.read=(this.read+1)%this.buffer.length;}
      this.hadAudio=true;
    };
  }
  process(_inputs,outputs) {
    const output=outputs[0]?.[0];
    if(output)for(let i=0;i<output.length;i++){if(this.count){output[i]=this.buffer[this.read];this.read=(this.read+1)%this.buffer.length;this.count--;}else output[i]=0;}
    if(this.hadAudio && this.count===0){this.hadAudio=false;this.port.postMessage("drained");}
    return true;
  }
}
registerProcessor("inox-capture",InoxCapture);
registerProcessor("inox-playback",InoxPlayback);

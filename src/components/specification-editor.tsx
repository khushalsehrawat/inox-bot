"use client";
import { useId, useState } from 'react';

function parseSpecifications(text:string):string[][] {
  return text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).filter(line=>line.trim()).map(line=>{
    const separator=line.indexOf(':');
    return separator<0 ? [line.trim(),''] : [line.slice(0,separator).trim(),line.slice(separator+1).trim()];
  });
}
const templates:Record<string,string[]>={
  kitchen:['Product type','Material','Finish','Cabinet compatibility','Width','Depth','Height','Load capacity','Closing mechanism','Installation type'],
  wardrobe:['Product type','Material','Finish','Dimensions','Cabinet compatibility','Load capacity','Mounting type','Configuration'],
  hardware:['Product type','Material','Finish','Dimensions','Installation requirements','Compatibility'],
  facade:['Product type','Material','Core structure','Thickness','Panel dimensions','Surface finish','Application','Installation method','Certified performance'],
  accessories:['Product type','Material','Finish','Dimensions','Capacity','Cabinet compatibility','Package contents'],
};
export function SpecificationEditor({value,category,onChange}:{value:string;category:string;onChange:(value:string)=>void}) {
  const [error,setError]=useState('');
  const suggestionsId=useId();
  const rows=parseSpecifications(value);
  const kind=/façade|facade|honeycomb|aluminium/i.test(category)?'facade':/kitchen|pantry/i.test(category)?'kitchen':/wardrobe/i.test(category)?'wardrobe':/hardware/i.test(category)?'hardware':'accessories';
  function save(next:string[][]){onChange(next.map(([key,val])=>val ? `${key}: ${val}` : key).join('\n'));}
  return <div className="structured-specifications">
    <strong>Shared specifications</strong>
    <p>Paste specifications or upload a text file, then save the product to publish them. Include verified values and units. Variation values override matching shared names.</p>
    <div className="spec-import">
      <label>Paste specifications<textarea value={value} onChange={e=>onChange(e.target.value)} rows={4} placeholder={'Material: Stainless steel\nWidth: 450 mm\nSoft closing'}/></label>
      <p>One specification per line. A colon (:) splits the name on the left and value on the right. Lines without a colon stay on the left.</p>
      <label>Upload specifications (.txt)<input type="file" accept=".txt,text/plain" onChange={async e=>{
        const file=e.target.files?.[0];
        e.target.value='';
        if(!file)return;
        if(!/\.txt$/i.test(file.name)){setError('Choose a .txt text file.');return;}
        if(file.size>1024*1024){setError('Choose a text file smaller than 1 MB.');return;}
        try{onChange(await file.text());setError('');}catch{setError('Unable to read this file. Try again or paste the text.');}
      }}/></label>
      {error && <p role="alert">{error}</p>}
    </div>
    {rows.length>0 && <div className="spec-editor-head" aria-hidden="true"><span>Specification name</span><span>Value and unit</span><span/></div>}
    {rows.map(([key,val],i)=><div className="spec-editor-row" key={i}>
      <input aria-label={`Specification name ${i+1}`} list={suggestionsId} value={key} placeholder="Specification" onPaste={e=>{
        const text=e.clipboardData.getData('text');
        if(!/[:\r\n]/.test(text))return;
        const pasted=parseSpecifications(text);
        if(!pasted.length)return;
        e.preventDefault();
        save([...rows.slice(0,i),...pasted,...rows.slice(i+1)]);
      }} onChange={e=>save(rows.map((row,j)=>j===i?[e.target.value,val]:row))}/>
      <input aria-label={`Specification value ${i+1}`} value={val} placeholder="Verified value and unit" onChange={e=>save(rows.map((row,j)=>j===i?[key,e.target.value]:row))}/>
      <button type="button" className="upload-icon-button" aria-label={`Remove specification ${i+1}`} onClick={()=>save(rows.filter((_,j)=>j!==i))}>×</button>
    </div>)}
    <datalist id={suggestionsId}>{templates[kind].map(name=><option value={name} key={name}/>)}</datalist>
  </div>;
}

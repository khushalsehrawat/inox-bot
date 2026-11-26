"use client";
import { useEffect, useState } from 'react';
import { Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import type { ProductDraft } from '@/lib/web-taxonomy-store.mjs';
import type { WebCategory } from '@/lib/web-taxonomy-model';
import { catalogueCSV, catalogueHeaders, readCatalogueCSV, readCatalogueRows } from '@/lib/catalogue-csv.mjs';
export function CatalogueImport({onSaved,categories}:{onSaved:()=>void | Promise<void>;categories:WebCategory[]}) {
  const [history,setHistory]=useState<{date:string;created:number;updated:number;total:number;uploads:number}[]>([]);
  const [historyError,setHistoryError]=useState(''),[historyLoading,setHistoryLoading]=useState(true);
  async function loadHistory(){setHistoryLoading(true);setHistoryError('');try{const response=await fetch('/api/admin/catalogue-import?history=true',{cache:'no-store'});const data=await response.json();if(!response.ok)throw Error(data.message || 'Unable to load upload history.');setHistory(data.history);}catch(e){setHistoryError(e instanceof Error?e.message:'Unable to load upload history.');}finally{setHistoryLoading(false);}}
  useEffect(()=>{void loadHistory();},[]);
  const [preview,setPreview]=useState<{products:ProductDraft[];expires:number;token:string}>();
  const [message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[category,setCategory]=useState('');
  function download(name:string,text:string){const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function templateRow(){return {productSku:'EXAMPLE-PRODUCT',productName:'Example product',category:category || categories.find(c=>!c.parentId)?.id || '',sku:'EXAMPLE-OPTION-1',webVisible:true,featured:false,active:true,available:true,isDefault:true,specifications:'{}'};}
  async function excelTemplate(){setBusy(true);setError('');try{const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();const sheet=workbook.addWorksheet('Products');sheet.columns=catalogueHeaders.map(key=>({header:key,key,width:['description','keyFeatures','sharedSpecifications'].includes(key)?40:22,style:{numFmt:'@'}}));sheet.addRow(templateRow());sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];const reference=workbook.addWorksheet('Categories');reference.addRow(['categoryId','name','parentId']);categories.forEach(c=>reference.addRow([c.id,c.name,c.parentId || '']));reference.columns.forEach(c=>{c.width=35;});const url=URL.createObjectURL(new Blob([await workbook.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download='inox-product-template.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError(e instanceof Error?e.message:'Could not download the Excel template.');}finally{setBusy(false);}}
  async function request(body:unknown){const r=await fetch('/api/admin/catalogue-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>null);if(!r.ok)throw Error(d?.message || 'Unable to import products. Please try again.');return d;}
  async function exportProducts(){setBusy(true);setError('');try{const r=await fetch(`/api/admin/catalogue-import${category?`?category=${encodeURIComponent(category)}`:''}`);if(!r.ok){const d=await r.json();throw Error(d.message);}download(category?'inox-category-products.csv':'inox-all-products.csv',await r.text());}catch(e){setError(e instanceof Error?e.message:'Download failed.');}finally{setBusy(false);}}
  async function upload(file:File){setBusy(true);setPreview(undefined);setMessage('');setError('');try{
    if(file.size>2000000)throw Error('Choose a CSV or XLSX file under 2 MB.');
    let rows;
    if(file.name.toLowerCase().endsWith('.xlsx')){
      const {default:ExcelJS}=await import('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await file.arrayBuffer());const sheet=workbook.worksheets[0];
      if(!sheet || sheet.rowCount>501)throw Error('Include a header and 1–500 variation rows.');
      const width=sheet.getRow(1).cellCount;const matrix:string[][]=[];
      sheet.eachRow(row=>{const values=Array.from({length:Math.max(width,row.cellCount)},(_,j)=>{const cell=row.getCell(j+1);if(cell.type===ExcelJS.ValueType.Formula)throw Error('Replace spreadsheet formulas with their values before uploading.');return cell.text;});if(values.some(v=>v.trim()))matrix.push(values);});
      rows=readCatalogueRows(matrix);
    }else if(file.name.toLowerCase().endsWith('.csv'))rows=readCatalogueCSV(await file.text());
    else throw Error('Choose a .csv or .xlsx file.');
    setPreview(await request({operation:'preview',rows}));
  }catch(e){setError(e instanceof Error?e.message:'Import failed.');}finally{setBusy(false);}}
  return <section className="table-panel padded catalogue-csv-panel">
    <span className="eyebrow">Spreadsheet management</span><h2>Edit your catalogue in Excel.</h2>
    <p>Download a CSV, edit it in Excel, then upload CSV or XLSX. One row per variation. Keep productId, variationId and version unchanged when editing names or SKUs. Images and PDFs are added only through the product editor and are preserved during import.</p>
    <div className="catalogue-csv-actions">
      <button type="button" className="button outline" disabled={busy} onClick={()=>download('inox-product-template.csv',catalogueCSV([templateRow()]))}><Download size={16}/>Download CSV template</button>
      <button type="button" className="button outline" disabled={busy} onClick={()=>void excelTemplate()}><Download size={16}/>Download Excel template</button>
      <select aria-label="Export category" value={category} onChange={e=>setCategory(e.target.value)}>{<option value="">All categories</option>}{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button type="button" className="button outline" disabled={busy} onClick={()=>void exportProducts()}><Download size={16}/>{category?'Download category CSV':'Download all products CSV'}</button>
      <button type="button" className="button outline" disabled={busy} onClick={()=>download('inox-categories.csv','\uFEFF'+[['categoryId','name','parentId'],...categories.map(c=>[c.id,c.name,c.parentId || ''])].map(row=>row.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n'))}>Category reference CSV</button>
    </div>
    <p className="catalogue-csv-help">For new products, leave the ID and version columns blank. Required: productSku, productName, category, sku. Set webVisible to true to publish or false to hide. Use true/false for flags, plain numbers for prices, and JSON objects for variation specifications. Blank optional cells clear values; omitted columns preserve existing values. Rows omitted from a product keep their existing variations. Upload up to 500 variation rows and 2 MB per file; split larger exports into smaller files.</p>
    <label className="upload-zone"><Upload/><strong>{busy?'Processing your file…':'Upload your edited CSV or Excel file'}</strong><span>Validate and preview before applying changes</span><input aria-label="Upload product spreadsheet" type="file" accept=".csv,.xlsx" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file);}}/></label>
    {error && <p role="alert" className="form-error"><AlertCircle size={16}/> {error}</p>}
    {preview && <><h3>Review {preview.products.length} products</h3><div className="table-scroll"><table><thead><tr><th>Action</th><th>Product SKU</th><th>Name</th><th>Variations</th><th>Website</th></tr></thead><tbody>{preview.products.map(p=><tr key={p.id}><td>{p.version?'Update':'Create'}</td><td>{p.sku}</td><td>{p.name}</td><td>{p.variations?.length}</td><td>{p.webVisible?'Published':'Hidden'}</td></tr>)}</tbody></table></div><p>Confirming applies all changes together. If any product fails, nothing is saved.</p><button type="button" className="button dark" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const d=await request({operation:'confirm',...preview});setMessage(`${d.count} products saved. Published products are now available on the website.`);setPreview(undefined);await loadHistory();await onSaved();}catch(e){setError(e instanceof Error?e.message:'Import failed.');}finally{setBusy(false);}}}><CheckCircle2 size={16}/>{busy?'Applying changes…':'Apply changes to website'}</button></>}
    {message && <p role="status" className="catalogue-csv-success">{message}</p>}
    <section aria-labelledby="catalogue-history-title" className="catalogue-upload-history">
      <div className="catalogue-csv-actions"><h3 id="catalogue-history-title">Product upload history</h3><button type="button" className="button outline" disabled={historyLoading} onClick={()=>void loadHistory()}>Refresh history</button></div>
      <p className="catalogue-csv-help">Daily totals in Indian time (IST). Includes spreadsheet imports and saves through the admin product editor. Updates count each successful save; new products are counted once. Older dates are recovered from the earliest available Hostinger save records and may differ from the original upload time. Session counts include recorded sessions only.</p>
      {historyLoading ? <p role="status">Loading upload history…</p> : historyError ? <p role="alert" className="form-error">{historyError}</p> : history.length ? <div className="table-scroll"><table><thead><tr><th>Date (IST)</th><th>New products</th><th>Product updates</th><th>Total processed</th><th>Save / upload sessions</th></tr></thead><tbody>{history.map(day=><tr key={day.date}><td>{new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}).format(new Date(`${day.date}T12:00:00Z`))}</td><td>{day.created}</td><td>{day.updated}</td><td>{day.total}</td><td>{day.uploads}</td></tr>)}</tbody></table></div> : <p>No product uploads recorded yet.</p>}
    </section>
  </section>;
}

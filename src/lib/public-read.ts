// Public rendering may degrade gracefully; administrative reads/writes still fail closed.
export async function publicRead<T>(read:()=>Promise<T>, fallback:T):Promise<{data:T;available:boolean}> {
  try { return {data:await read(),available:true}; }
  catch { return {data:fallback,available:false}; }
}

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Uom = { base: string; toBase: Record<string, number> };
type Item = {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  supplier?: string;
  orderMultiple?: number;
  sku?: string;
  uom?: Uom;
  par?: number;
};

const LS_ITEMS = 'cenizo:items:v2';
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }
function numOrUndef(s:string){ const t=s.trim(); if(!t) return undefined; const n=Number(t.replace(/[^0-9.]/g,'')); return Number.isFinite(n)?n:undefined; }

export default function EditItemsPage(){
  const [rows, setRows] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');

  useEffect(()=> {
    try {
      const raw = localStorage.getItem(LS_ITEMS);
      const list: Item[] = raw ? JSON.parse(raw) : [];
      setRows(list);
    } catch { setRows([]); }
  }, []);

  function saveAll(){
    localStorage.setItem(LS_ITEMS, JSON.stringify(rows));
    alert('Saved all changes.');
  }
  function saveRow(id: string){
    localStorage.setItem(LS_ITEMS, JSON.stringify(rows));
    alert('Saved.');
  }
  function removeRow(id: string){
    if(!confirm('Remove item?')) return;
    const next = rows.filter(r=>r.id!==id);
    setRows(next);
    localStorage.setItem(LS_ITEMS, JSON.stringify(next));
  }
  function addUnit(i: number){
    const base = rows[i].uom?.base || 'each';
    const name = prompt('Add unit (e.g., sleeve, each, gram):','each'); if(!name) return;
    const per = Number(prompt(`How many "${name}" in ONE "${base}"?`,'0') || '0');
    setRows(prev=>{
      const r=[...prev]; const row={...r[i]}; const uom = row.uom ? { ...row.uom, toBase: { ...row.uom.toBase } } : { base:'each', toBase:{} };
      uom.toBase[name]=Math.max(0, per||0);
      row.uom=uom; r[i]=row; return r;
    });
  }
  function copyUomPar(i:number, fromId:string){
    const src = rows.find(r=>r.id===fromId); if(!src) return;
    setRows(prev=>{
      const r=[...prev]; const row={...r[i]};
      row.uom = src.uom ? { base: src.uom.base, toBase: { ...src.uom.toBase } } : undefined;
      row.par = src.par;
      r[i]=row; return r;
    });
  }

  const categories = useMemo(()=> {
    const s=new Set<string>(); rows.forEach(i=>{ if(i.category) s.add(i.category); });
    return ['all', ...Array.from(s).sort()];
  }, [rows]);

  const visible = useMemo(()=> {
    let list=rows.slice();
    if (cat!=='all') list=list.filter(i=>(i.category||'').toLowerCase()===cat.toLowerCase());
    if (query.trim()){ const q=query.toLowerCase(); list=list.filter(i=>i.name.toLowerCase().includes(q)||(i.sku||'').toLowerCase().includes(q)); }
    return list.sort((a,b)=>a.name.localeCompare(b.name));
  }, [rows, cat, query]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Manage Items</h1>
        <Link href="/inventory" className="ml-auto px-3 py-2 rounded border hover:bg-gray-50">Back to Inventory</Link>
        <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={saveAll}>Save All</button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input className="rounded border p-2 w-64" placeholder="Search…" value={query} onChange={e=>setQuery(e.target.value)} />
        <select className="rounded border p-2" value={cat} onChange={e=>setCat(e.target.value)}>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full text-sm border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 border text-left">Name</th>
              <th className="p-2 border">Category</th>
              <th className="p-2 border">SKU</th>
              <th className="p-2 border">Supplier</th>
              <th className="p-2 border">OM</th>
              <th className="p-2 border">Par (base)</th>
              <th className="p-2 border">UOM Base</th>
              <th className="p-2 border">Units (per 1 base)</th>
              <th className="p-2 border">Copy UOM/PAR</th>
              <th className="p-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, idxInVisible) => {
              const i = rows.findIndex(r=>r.id===row.id);
              const uom = rows[i].uom || { base:'each', toBase:{} };
              return (
                <tr key={row.id} className="align-top">
                  <td className="p-2 border">
                    <input className="w-56 rounded border p-1" value={rows[i].name}
                      onChange={e=>setRows(prev=>{ const r=[...prev]; r[i]={...r[i], name:e.target.value}; return r; })}/>
                  </td>
                  <td className="p-2 border">
                    <input className="w-32 rounded border p-1" value={rows[i].category || ''}
                      onChange={e=>setRows(prev=>{ const r=[...prev]; r[i]={...r[i], category:e.target.value || undefined}; return r; })}/>
                  </td>
                  <td className="p-2 border">
                    <input className="w-28 rounded border p-1" value={rows[i].sku || ''}
                      onChange={e=>setRows(prev=>{ const r=[...prev]; r[i]={...r[i], sku:e.target.value || undefined}; return r; })}/>
                  </td>
                  <td className="p-2 border">
                    <input className="w-40 rounded border p-1" value={rows[i].supplier || ''}
                      onChange={e=>setRows(prev=>{ const r=[...prev]; r[i]={...r[i], supplier:e.target.value || undefined}; return r; })}/>
                  </td>
                  <td className="p-2 border">
                    <input className="w-20 rounded border p-1" inputMode="numeric" value={String(rows[i].orderMultiple ?? '')}
                      onChange={e=>setRows(prev=>{ const r=[...prev]; r[i]={...r[i], orderMultiple: numOrUndef(e.target.value)}; return r; })}/>
                  </td>
                  <td className="p-2 border">
                    <input className="w-24 rounded border p-1" inputMode="numeric" value={String(rows[i].par ?? '')}
                      onChange={e=>setRows(prev=>{ const r=[...prev]; r[i]={...r[i], par: numOrUndef(e.target.value)}; return r; })}/>
                  </td>
                  <td className="p-2 border">
                    <input className="w-24 rounded border p-1" value={uom.base}
                      onChange={e=>setRows(prev=>{ const r=[...prev]; const u={...(r[i].uom||{base:'each',toBase:{}})}; u.base=e.target.value||'each'; r[i]={...r[i], uom:u}; return r; })}/>
                    <div className="text-[10px] text-gray-500 mt-1">e.g., case, bag, tub, each</div>
                  </td>
                  <td className="p-2 border">
                    <div className="space-y-1">
                      {Object.entries(uom.toBase).map(([u,per])=>(
                        <div className="flex items-center gap-2" key={u}>
                          <input className="w-24 rounded border p-1" value={u} onChange={e=>{
                            const newName=e.target.value || u;
                            setRows(prev=>{
                              const r=[...prev]; const to={...((r[i].uom?.toBase)||{})};
                              const v=to[u]; delete to[u]; to[newName]=v;
                              r[i]={...r[i], uom:{ base:(r[i].uom?.base)||'each', toBase: to }};
                              return r;
                            });
                          }}/>
                          <span>=</span>
                          <input className="w-20 rounded border p-1" inputMode="numeric" value={String(per)} onChange={e=>{
                            const v = Number((e.target.value||'').replace(/[^0-9.]/g,'')) || 0;
                            setRows(prev=>{
                              const r=[...prev]; const to={...((r[i].uom?.toBase)||{})}; to[u]=v;
                              r[i]={...r[i], uom:{ base:(r[i].uom?.base)||'each', toBase: to }};
                              return r;
                            });
                          }}/>
                          <span>per 1 {uom.base||'base'}</span>
                          <button className="px-2 py-0.5 rounded border hover:bg-gray-50" onClick={()=>{
                            setRows(prev=>{
                              const r=[...prev]; const to={...((r[i].uom?.toBase)||{})}; delete to[u];
                              r[i]={...r[i], uom:{ base:(r[i].uom?.base)||'each', toBase: to }};
                              return r;
                            });
                          }}>remove</button>
                        </div>
                      ))}
                    </div>
                    <button className="mt-2 px-2 py-1 rounded border hover:bg-gray-50" onClick={()=>addUnit(i)}>+ unit</button>
                  </td>
                  <td className="p-2 border">
                    <select className="w-44 rounded border p-1" onChange={e=>{ const fromId=e.target.value; if(fromId) copyUomPar(i, fromId); }}>
                      <option value="">-- choose item --</option>
                      {rows.filter(r=>r.id!==row.id).map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <div className="text-[10px] text-gray-500 mt-1">Copies UOM base + units and PAR</div>
                  </td>
                  <td className="p-2 border whitespace-nowrap">
                    <button className="px-2 py-1 rounded border hover:bg-gray-50 mr-2" onClick={()=>saveRow(row.id)}>Save</button>
                    <button className="px-2 py-1 rounded border hover:bg-red-50" onClick={()=>removeRow(row.id)}>Remove</button>
                  </td>
                </tr>
              );
            })}
            {visible.length===0 && <tr><td className="p-2 border text-gray-500" colSpan={10}>No items.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

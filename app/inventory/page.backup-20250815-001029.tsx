
'use client';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/** -------------------------------------------
 * Types
 * ------------------------------------------*/
type Location = { group: string; key: string; name: string; countUnits: string[] };
type UomMap = { base: string; toBase: Record<string, number> };
type Item = {
  id: string;
  name: string;
  category?: string;
  sku?: string;
  supplier?: string;
  uom?: UomMap;
  orderMultiple?: number;
  locations: string[];         // location keys where this item appears
  par?: Record<string, number>;// per-location par, stored in BASE units
};
type Line = { itemId: string; name: string; unit?: string; qty: number };
type Run = {
  id: string;
  locationKey: string;
  locationName: string;
  group: string;
  date: string;        // yyyy-mm-dd (local)
  by?: string;
  startedAt?: string;
  completedAt?: string;
  index: number;
  lines: Line[];
};
type BomComp = { itemId?: string; qty: number; uom?: string };
type Bom = {
  key: string; name: string; sku?: string; type: "drink"|"pastry"|"other";
  comps: { cup?: BomComp; lid?: BomComp; milk?: BomComp; espresso?: BomComp; syrup?: BomComp; bag?: BomComp };
  updatedAt: string;
};

/** -------------------------------------------
 * LocalStorage keys
 * ------------------------------------------*/
const LS_ITEMS      = "cenizo-inventory-items-v2";
const LS_RUNS       = "cenizo-inventory-runs-v2";
const LS_BOMS       = "cenizo-inventory-boms-v2";
const LS_OVERRIDES  = "cenizo-inventory-overrides-v2";

/** -------------------------------------------
 * Locations & starter categories
 * ------------------------------------------*/
const LOCATIONS: Location[] = [
  { group: "Cenizo",       key: "Cenizo:Easton Park",        name: "Easton Park",        countUnits: ["each","sleeve"] },
  { group: "Cenizo",       key: "Cenizo:Del Valle",          name: "Del Valle",          countUnits: ["each","sleeve"] },
  { group: "Sano Market",  key: "Sano:Sano Easton Park",     name: "Sano Easton Park",   countUnits: ["each","case"] },
  { group: "Warehouse",    key: "Wh:Old Lockhart",           name: "Old Lockhart",       countUnits: ["case"] },
  { group: "Warehouse",    key: "Wh:Chrysler Bend",          name: "Chrysler Bend",      countUnits: ["case"] },
];

const STARTER_CATEGORIES = [
  "Cups","Lids","Milks","Syrups","Bags","Consumables","Cleaning Supplies","Ingredients",
  "Prepped Bev","Retail","Bev Supplies","Misc Bev","Beverage Base"
];

/** -------------------------------------------
 * Helpers
 * ------------------------------------------*/
const todayLocalISO = () => {
  const d = new Date(); const z = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return z.toISOString().slice(0,10);
};
const slug = (s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const csvEscape = (s:string)=>`"${(s||"").replace(/"/g,'""')}"`;
const toLocal = (s?:string)=>s?new Date(s).toLocaleString():"";

/** storage */
function load<T>(k:string, def:T):T { if (typeof window==='undefined') return def; try { const v=localStorage.getItem(k); return v?JSON.parse(v):def; } catch { return def; } }
function save<T>(k:string, v:T){ if (typeof window==='undefined') return; localStorage.setItem(k, JSON.stringify(v)); }

/** UOM conversions */
function toBaseUnits(it: Item|undefined, qty:number, u?:string){
  if (!it?.uom) return qty;
  if (!u || u===it.uom.base) return qty;
  const per = it.uom.toBase?.[u]; if (!per || per<=0) return qty;
  return qty/per;
}
function fromBaseUnits(it: Item|undefined, baseQty:number, desired:string){
  if (!it?.uom) return baseQty;
  if (desired===it.uom.base) return baseQty;
  const per = it.uom.toBase?.[desired]; if (!per || per<=0) return baseQty;
  return baseQty*per;
}

/** seed items (short ids generated from name) */
const SEED: Item[] = (() => {
  const list = [
    ["Coffee Bulk","Talisman (Espresso)"],
    ["Cups","4oz sample"],["Cups","8oz Hot"],["Cups","12oz Hot"],["Cups","16oz Hot"],["Cups","12oz Cold"],["Cups","16oz Cold"],
    ["House Syrups","Cafe De Olla"],["House Syrups","Churro"],["House Syrups","Vanilla"],["House Syrups","Honey Lavendar"],
    ["House Syrups","Simple"],["House Syrups","SF Vanilla"],["House Syrups","Honey"],
    ["Lids","Cold Sipper"],["Lids","8oz Hot Sipper"],["Lids","12/16 Hot Sipper"],
    ["Milk","Whole"],["Milk","Almond"],["Milk","Oat"],["Milk","Heavy Whipping Cream"],["Milk","1/2 & 1/2"],
    ["Misc Bev","Liquid Death"],["Misc Bev","Juice Boxes"],["Misc Bev","Sparkling Water"],["Misc Bev","Hot Cocoa Mix"],
    ["Packaging","Paper Bags w/ Handle"],["Prepped Bev","Horchata Blended"],["Prepped Bev","Horchata Steeping"],
    ["Prepped Bev","Hibby Hollow Iced Tea"],["Prepped Bev","Cold Brew Concentrate"],
    ["Syrups","Dark Chocolate Sauce"],["Syrups","White Chocolate Sauce"],
    ["Retail","THC Sativa Gummies"],["Retail","THC Indica Gummies"],["Retail","THC Hybrid Gummies"],
    ["Bev Supplies","Coffee Filters"],["Bev Supplies","Tea Bags"],["Bev Supplies","Hot Cup Sleeves"],
    ["Cleaning Supplies","Compost Bags"],["Cleaning Supplies","Microfiber Towels"],["Cleaning Supplies","Sanitizer"],
    ["Cleaning Supplies","Dish Soap"],["Cleaning Supplies","Hand Wash Soap"],["Cleaning Supplies","Floor Cleaner"],
    ["Cleaning Supplies","Cafiza"],["Cleaning Supplies","Tabz Coffee Tablets"],["Cleaning Supplies","Dairy Cleaner"],
    ["Cleaning Supplies","Grindz tablets"],["Cleaning Supplies","Trash Bags"],["Cleaning Supplies","Sponges"],
    ["Cleaning Supplies","Black Gloves"],["Cleaning Supplies","Dish Brushes"],["Cleaning Supplies","Dish Gloves"],
    ["Coffee Bulk","Decaf Vienna"],["Coffee Bulk","Lonestar Blend (Cold Brew)"],["Coffee Bulk","Victory (Drip)"],
    ["Consumables","Straws"],["Consumables","Cenizo Drink Stickers"],["Consumables","Drink Stoppers"],["Consumables","Sugar Packets"],
    ["Consumables","Stevia Packets"],["Consumables","Cinnamon Powder"],["Consumables","Wooden Stir Sticks"],
    ["Consumables","Cup Carriers"],["Consumables","Customer Napkins"],["Consumables","Handwash Paper Towels"],
    ["Consumables","White Paper Towels"],["Consumables","Receipt Paper"],["Consumables","Sharpies"],["Consumables","Expo"],
    ["Consumables","AAA batteries"],["Consumables","AA batteries"],["Consumables","Dog Treats"],
    ["Packaging","Pastry Bags"],["Retail","Cenizo Dark Roast"],["Retail","Cenizo Blend"],["Retail","Cenizo Retail Stickers"],
    ["Syrups","Monin Hazelnut"],["Syrups","Monin Caramel"],["Syrups","Monin SF Caramel"],["Syrups","Monin Mango"],
    ["Syrups","Monin Raspberry"],["Syrups","Monin Blackberry"],["Syrups","Monin Watermelon"],
    ["Tea","Matcha"],["Tea","Chai"],["Tea","Earl Gray"],["Tea","Chamomile"],["Tea","Hibby Hollow"],["Tea","Strawberry Peach"],
    ["Ingredients","Piloncillo"],["Ingredients","Honey"],["Ingredients","Vanilla"],["Ingredients","Sugar"],["Ingredients","Rice"],
    ["Ingredients","Oranges"],["Ingredients","Cinnamon Sticks"],["Ingredients","Lavender"],["Ingredients","Brown Sugar"],
    ["Ingredients","Evaporated Milk"],["Ingredients","Sweetened Condensed"],["Ingredients","Stevia"],["Ingredients","Pink Salt"],
    ["Supplies","Sanitizer Test Strips"],
  ];
  const allLocs = LOCATIONS.map(l=>l.key);
  return list.map(([cat,name])=>{
    const id = "seed-" + slug(cat+"-"+name);
    const baseUom: UomMap|undefined =
      cat==="Cups" ? { base:"case", toBase:{ sleeve:20, each:1000 } } :
      cat==="Lids" ? { base:"case", toBase:{ sleeve:20, each:1000 } } :
      cat==="Coffee Bulk" ? { base:"tub", toBase:{ gram:13608 } } : // ~30lb tub
      cat==="Milk" ? { base:"each", toBase:{} } :
      undefined;
    return { id, name, category: cat==="Tea"||cat==="Coffee Bulk" ? "Beverage Base" : cat, uom: baseUom, locations: allLocs };
  });
})();

/** -------------------------------------------
 * Data accessors
 * ------------------------------------------*/
function getItems(): Item[] {
  const saved = load<Item[]>(LS_ITEMS, []);
  if (saved.length) return saved;
  save(LS_ITEMS, SEED);
  return SEED;
}
function setItems(items: Item[]){
  save(LS_ITEMS, items);
}
function getRuns(): Record<string, Run> { return load(LS_RUNS, {} as Record<string,Run>); }
function setRun(r:Run){
  const all = getRuns(); all[r.id]=r; save(LS_RUNS, all);
}
function getBoms(): Record<string,Bom> { return load(LS_BOMS, {} as Record<string,Bom>); }
function setBom(b:Bom){
  const all = getBoms(); all[b.key]=b; save(LS_BOMS, all);
}

/** -------------------------------------------
 * UI helpers
 * ------------------------------------------*/
function allCategories(items: Item[]){
  const s = new Set<string>(STARTER_CATEGORIES);
  items.forEach(i=>{ if (i.category && i.category.trim()) s.add(i.category.trim()); });
  return Array.from(s).sort((a,b)=>a.localeCompare(b));
}
function itemsByCategory(items: Item[], cat: string){
  return items.filter(i=> (i.category||"").toLowerCase()===cat.toLowerCase());
}
function itemsForSlot(items: Item[], slot:"cup"|"lid"|"milk"|"espresso"|"syrup"|"bag"){
  const catMap: Record<typeof slot, string[]> = {
    cup: ["Cups"],
    lid: ["Lids"],
    milk:["Milks","Milk"],
    espresso:["Beverage Base","Coffee","Coffee Bulk","Tea"],
    syrup:["Syrups","House Syrups"],
    bag:["Bags","Packaging"]
  } as any;
  const wanted = new Set(catMap[slot].map(s=>s.toLowerCase()));
  const filtered = items.filter(i=>i.category && wanted.has(i.category.toLowerCase()));
  return filtered.length ? filtered : items;
}
function suggestLidNameForCup(cupName:string){
  const s = cupName.toLowerCase();
  if (s.includes("8oz") && s.includes("hot")) return "8oz Hot Sipper";
  if (s.includes("12") || s.includes("16")) if (s.includes("hot")) return "12/16 Hot Sipper";
  if (s.includes("cold")) return "Cold Sipper";
  return "";
}

/** -------------------------------------------
 * Page component
 * ------------------------------------------*/
export default function InventoryPage(){
  const [group, setGroup] = useState<string>(LOCATIONS[0].group);
  const groups = useMemo(()=>Array.from(new Set(LOCATIONS.map(l=>l.group))),[]);
  const groupLocs = useMemo(()=>LOCATIONS.filter(l=>l.group===group),[group]);
  const [locKey, setLocKey] = useState<string>(groupLocs[0]?.key || LOCATIONS[0].key);
  useEffect(()=>{ if(!groupLocs.find(l=>l.key===locKey)) setLocKey(groupLocs[0]?.key||LOCATIONS[0].key); },[group,groupLocs,locKey]);

  const [items,setItemsState] = useState<Item[]>(getItems());
  useEffect(()=>{ setItemsState(getItems()); },[]);
  const itemsById = useMemo(()=>{ const m:Record<string,Item>={}; items.forEach(i=>m[i.id]=i); return m; },[items]);

  const [showManage, setShowManage] = useState(false);
  const [showImport, setShowImport] = useState(false);

  /** Start/Resume today's run */
  const loc = LOCATIONS.find(l=>l.key===locKey)!;
  const runId = `${locKey}__${todayLocalISO()}`;
  const [run, setRunState] = useState<Run|undefined>(undefined);
  useEffect(()=>{
    const existing = getRuns()[runId];
    if (existing) { setRunState(existing); return; }
    // new
    const lines: Line[] = items
      .filter(i=>i.locations.includes(locKey))
      .sort((a,b)=>a.name.localeCompare(b.name))
      .map(i=>({ itemId:i.id, name:i.name, unit:i.uom?.base, qty: 0 }));
    const r: Run = { id:runId, group:loc.group, locationKey:loc.key, locationName:loc.name,
      date: todayLocalISO(), index: 0, lines, startedAt: new Date().toISOString() };
    setRunState(r); setRun(r);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[runId, items.length, locKey]);

  function setRun(r:Run){ setRunState(r); setRun(r); }

  /** Counting controls */
  const cur = run?.lines[run.index];
  function nudge(d:number){ if(!run||!cur) return; const next = { ...run }; next.lines[run.index] = { ...cur, qty: Math.max(0, (cur.qty||0)+d) }; setRun(next); }
  function setQty(q:number){ if(!run||!cur) return; const next = { ...run }; next.lines[run.index] = { ...cur, qty: Math.max(0, Math.floor(q)) }; setRun(next); }
  function goNext(){ if(!run) return; setRun({ ...run, index: Math.min(run.lines.length-1, run.index+1) }); }
  function goPrev(){ if(!run) return; setRun({ ...run, index: Math.max(0, run.index-1) }); }
  function jumpTo(i:number){ if(!run) return; setRun({ ...run, index:i }); }

  /** Order math (stays in base units; display in chosen count unit) */
  function parForHere(it: Item){
    return Number(it.par?.[locKey] || 0);
  }
  function needForHere(it:Item, counted:number){
    const parBase = parForHere(it);
    const onHandBase = toBaseUnits(it, counted, loc.countUnits[0]||it.uom?.base);
    return Math.max(0, parBase - onHandBase);
  }
  function suggestedOrder(it:Item, counted:number){
    const needBase = needForHere(it, counted);
    const om = it.orderMultiple||1;
    return Math.ceil(needBase/om)*om;
  }

  /** Export / Order CSV */
  function exportRunCSV(){
    if(!run) return;
    const lines:string[] = [];
    lines.push(["Group",run.group].join(","));
    lines.push(["Location",run.locationName].join(","));
    lines.push(["Run ID",run.id].join(","));
    lines.push(["Started",csvEscape(toLocal(run.startedAt))].join(","));
    lines.push(["Completed",csvEscape(toLocal(run.completedAt))].join(","));
    lines.push("");
    lines.push(["Item","Unit","Qty"].join(","));
    run.lines.forEach(l=>lines.push([csvEscape(l.name),csvEscape(l.unit||""), String(l.qty||0)].join(",")));
    const blob = new Blob([lines.join("\n")],{type:"text/csv"});
    const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`inventory_${slug(run.locationName)}_${run.date}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),500);
  }

  /** Manage Items */
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const cats = useMemo(()=>allCategories(items),[items]);

  function saveItemsBulk(next: Item[]){
    setItemsState(next); setItems(next);
  }

  function copyFrom(srcId:string, dstId:string, mode:"uom"|"all"){
    const src = itemsById[srcId]; const dst = itemsById[dstId];
    if(!src || !dst) return;
    const next = items.map(i=>{
      if (i.id!==dstId) return i;
      if (mode==="uom") return { ...i, uom: src.uom ? JSON.parse(JSON.stringify(src.uom)) : undefined };
      // all (except id & name)
      const keep = { id:i.id, name:i.name };
      return { ...keep, category:src.category, sku:src.sku, supplier:src.supplier, uom: src.uom?JSON.parse(JSON.stringify(src.uom)):undefined,
        orderMultiple:src.orderMultiple, locations:[...src.locations], par: src.par?JSON.parse(JSON.stringify(src.par)):undefined } as Item;
    });
    saveItemsBulk(next);
  }

  /** Import / BOM modal */
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [idxItem,setIdxItem] = useState(-1);
  const [idxSku,setIdxSku]   = useState(-1);
  const [idxQty,setIdxQty]   = useState(-1);
  const [soldTotals,setSoldTotals] = useState<Record<string,{ key:string; name:string; sku?:string; qty:number }>>({});
  function parseCSV(txt:string){
    const rows:string[][]=[]; let row:string[]=[]; let v=""; let q=false;
    for(let i=0;i<txt.length;i++){ const c=txt[i];
      if(q){ if(c==='"'){ const n=txt[i+1]; if(n==='"'){ v+='"'; i++; } else q=false; } else v+=c; }
      else{ if(c==='"') q=true; else if(c===','){ row.push(v); v=""; } else if(c==='\n'){ row.push(v); rows.push(row); row=[]; v=""; } else if(c!=='\r') v+=c; }
    }
    row.push(v); rows.push(row);
    while(rows.length && rows[rows.length-1].every(c=>(c||"").trim()==="")) rows.pop();
    return rows;
  }
  function autoMap(headers:string[]){
    const low=headers.map(h=>h.toLowerCase());
    const find=(cands:string[])=>low.findIndex(h=>cands.some(k=>h.includes(k)));
    return {
      item: find(["item","product","name","menu"]),
      sku:  find(["sku","plu","id","code"]),
      qty:  find(["qty sold","quantity sold","qty","quantity","sold","units"])
    };
  }
  function recomputeTotals(rows:string[][], iItem:number,iSku:number,iQty:number){
    const t:Record<string,{key:string; name:string; sku?:string; qty:number}> = {};
    rows.forEach(r=>{
      const name=r[iItem]||""; const sku=iSku>=0?(r[iSku]||""):""; const qty=Number((r[iQty]||"").replace(/[^0-9.\-]/g,""))||0;
      const key = (sku||name.trim().toLowerCase()); if(!key) return;
      if(!t[key]) t[key]={ key, name, sku: sku||undefined, qty:0 };
      t[key].qty += qty;
    });
    setSoldTotals(t);
  }
  function computeUsageFromBoms(totals:Record<string,{key:string;name:string;sku?:string;qty:number}>, bomMap:Record<string,Bom>){
    const used:Record<string,number> = {};
    Object.values(totals).forEach(row=>{
      const bom = bomMap[row.key]; if(!bom) return;
      const sold = Number(row.qty||0);
      (["cup","lid","milk","espresso","syrup","bag"] as const).forEach(slot=>{
        const comp = bom.comps[slot]; if(!comp?.itemId || !isFinite(comp.qty)) return;
        const invItem = itemsById[comp.itemId]; const base = toBaseUnits(invItem, Number(comp.qty), comp.uom);
        used[comp.itemId] = (used[comp.itemId]||0) + sold*base;
      });
    });
    return used;
  }
  function applyPrefillToToday(){
    if(!run) return;
    const used = computeUsageFromBoms(soldTotals, getBoms());
    const byId = { ...itemsById };
    const nextLines = run.lines.map(l=>{
      const inv = byId[l.itemId]; const u = Number(used[l.itemId]||0);
      const curBase = toBaseUnits(inv, l.qty, loc.countUnits[0]||inv?.uom?.base);
      const estBase = Math.max(0, curBase - u);
      const estDisplay = Math.floor(fromBaseUnits(inv, estBase, loc.countUnits[0]||inv?.uom?.base||"each"));
      return { ...l, qty: estDisplay };
    });
    setRun({ ...run, lines: nextLines });
    alert("Applied prefill from sales. Review counts and save.");
  }

  /** Rendering */
  return (
    <div className="p-4 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-sm font-medium mb-1">Business</label>
          <select className="w-full border rounded p-2" value={group} onChange={e=>setGroup(e.target.value)}>
            {groups.map(g=><option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Location</label>
          <select className="w-full border rounded p-2" value={locKey} onChange={e=>setLocKey(e.target.value)}>
            {groupLocs.map(l=><option key={l.key} value={l.key}>{l.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button className="px-3 py-2 rounded border" onClick={()=>setShowImport(true)}>Import Toast CSV (BOM + Prefill)</button>
        <button className="px-3 py-2 rounded border" onClick={()=>setShowManage(true)}>Manage Items</button>
        <button className="px-3 py-2 rounded border" onClick={exportRunCSV}>Export CSV (this location)</button>
      </div>

      {/* Counting card */}
      {run && cur && (
        <div className="rounded-2xl border shadow-sm mb-4">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="text-sm text-gray-500">Item {run.index+1} of {run.lines.length}</div>
            <div className="text-sm text-gray-500">{run.locationName}</div>
          </div>

          <div className="p-4 space-y-4">
            <div className="text-2xl font-bold tracking-tight">{cur.name}</div>

            <div className="flex gap-2 items-center">
              <input type="number" className="border rounded-xl p-3 text-xl w-40"
                value={cur.qty} onChange={e=>setQty(Number(e.target.value||0))} />
              {loc.countUnits.map(u=>
                <button key={u} className="px-3 py-2 rounded border"
                  onClick={()=>setQty((cur.qty||0)+ (u==="sleeve"?1:1)) /* still +1 display unit */}
                >+1 {u}</button>
              )}
              <button className="px-3 py-2 rounded border" onClick={()=>nudge(-1)}>-1</button>
              <button className="px-3 py-2 rounded border" onClick={()=>nudge(+1)}>+1</button>
              <button className="px-3 py-2 rounded border" onClick={()=>setQty(0)}>Set 0</button>
            </div>

            <div className="rounded border bg-gray-50 p-3 text-sm">
              {(()=>{
                const it = itemsById[cur.itemId]; if(!it) return null;
                const parB = parForHere(it);
                const needB = needForHere(it, cur.qty);
                const suggB = suggestedOrder(it, cur.qty);
                const displayU = loc.countUnits[0] || it.uom?.base || "each";
                const onHandDisplay = cur.qty;
                const parDisplay = Math.round(fromBaseUnits(it, parB, displayU)*100)/100;
                const needDisplay = Math.round(fromBaseUnits(it, needB, displayU)*100)/100;
                const suggDisplay = Math.round(fromBaseUnits(it, suggB, it.uom?.base||displayU)*100)/100;
                return (
                  <div className="flex flex-wrap gap-4">
                    <div><span className="text-gray-600">Supplier:</span> <span className="font-medium">{it.supplier||"—"}</span></div>
                    <div><span className="text-gray-600">SKU:</span> <span className="font-medium">{it.sku||"—"}</span></div>
                    <div><span className="text-gray-600">On hand ({displayU}):</span> <span className="font-medium">{onHandDisplay}</span></div>
                    <div><span className="text-gray-600">PAR ({displayU}):</span> <span className="font-medium">{parDisplay}</span></div>
                    <div><span className="text-gray-600">Need ({displayU}):</span> <span className="font-medium">{needDisplay}</span></div>
                    <div><span className="text-gray-600">Suggested order (base):</span> <span className="font-medium">{suggDisplay}</span></div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between">
              <button className="px-3 py-2 rounded border" onClick={goPrev} disabled={run.index===0}>Prev</button>
              <button className="px-3 py-2 rounded border" onClick={goNext} disabled={run.index>=run.lines.length-1}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick list */}
      {run && (
        <div className="rounded-2xl border">
          <div className="px-4 py-2 border-b font-medium">Quick List</div>
          <ul className="max-h-72 overflow-auto divide-y">
            {run.lines.map((ln,i)=>{
              const active = i===run.index;
              return (
                <li key={ln.itemId} onClick={()=>jumpTo(i)}
                  className={`px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${active?"bg-gray-50":""}`}>
                  <div className="truncate">
                    <div className="font-medium truncate">{ln.name}</div>
                    <div className="text-xs text-gray-500">{itemsById[ln.itemId]?.uom?.base || ""}</div>
                  </div>
                  <div className="text-sm w-10 text-right">{ln.qty}</div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Manage Items Modal */}
      {showManage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-auto" onClick={()=>setShowManage(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[1200px] p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Manage Items</div>
              <button className="px-3 py-1.5 rounded border" onClick={()=>setShowManage(false)}>Close</button>
            </div>

            <div className="flex gap-2 mb-3">
              <input className="border rounded p-2 flex-1" placeholder="Search…" value={filter} onChange={e=>setFilter(e.target.value)} />
              <select className="border rounded p-2" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
                <option value="all">all</option>
                {cats.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 border w-56">Name</th>
                    <th className="p-2 border w-40">Category</th>
                    <th className="p-2 border w-28">SKU</th>
                    <th className="p-2 border w-36">Supplier</th>
                    <th className="p-2 border w-20">OM</th>
                    <th className="p-2 border w-28">Par (base)</th>
                    <th className="p-2 border w-28">UOM Base</th>
                    <th className="p-2 border">Units (per 1 base)</th>
                    <th className="p-2 border w-52">Copy from</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter(i=> (catFilter==="all" || (i.category||"")===catFilter)
                             && (filter==="" || i.name.toLowerCase().includes(filter.toLowerCase())))
                    .map(i=>{
                      const catOpts = cats;
                      return (
                        <tr key={i.id} className="align-top">
                          <td className="p-2 border"><input className="w-56 border rounded p-1" value={i.name}
                               onChange={e=>saveItemsBulk(items.map(x=>x.id===i.id?{...x,name:e.target.value}:x))}/></td>
                          <td className="p-2 border">
                            <select className="w-40 border rounded p-1" value={i.category||""}
                              onChange={e=>saveItemsBulk(items.map(x=>x.id===i.id?{...x,category:e.target.value||undefined}:x))}>
                              <option value=""></option>
                              {catOpts.map(c=><option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="p-2 border"><input className="w-28 border rounded p-1" value={i.sku||""}
                               onChange={e=>saveItemsBulk(items.map(x=>x.id===i.id?{...x,sku:e.target.value||undefined}:x))}/></td>
                          <td className="p-2 border">
                            <select className="w-36 border rounded p-1" value={i.supplier||""}
                              onChange={e=>saveItemsBulk(items.map(x=>x.id===i.id?{...x,supplier:e.target.value||undefined}:x))}>
                              <option value=""></option>
                              {Array.from(new Set(items.map(x=>x.supplier).filter(Boolean) as string[])).sort().map(s=><option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td className="p-2 border"><input className="w-20 border rounded p-1" inputMode="numeric" value={String(i.orderMultiple||"")}
                               onChange={e=>saveItemsBulk(items.map(x=>x.id===i.id?{...x,orderMultiple:Number(e.target.value.replace(/[^0-9]/g,""))||undefined}:x))}/></td>
                          <td className="p-2 border"><input className="w-28 border rounded p-1" inputMode="decimal" value={String(i.par?.[locKey]??"")}
                               onChange={e=>{
                                 const n = Number(e.target.value.replace(/[^0-9.]/g,""))||0;
                                 saveItemsBulk(items.map(x=>{
                                   if (x.id!==i.id) return x;
                                   const par = { ...(x.par||{}) }; par[locKey]=n; return { ...x, par };
                                 }));
                               }}/></td>
                          <td className="p-2 border">
                            <select className="w-28 border rounded p-1" value={i.uom?.base||""}
                              onChange={e=>{
                                const base = e.target.value;
                                saveItemsBulk(items.map(x=>{
                                  if (x.id!==i.id) return x;
                                  const toBase = { ...(x.uom?.toBase||{}) };
                                  return { ...x, uom: base?{ base, toBase }:undefined };
                                }));
                              }}>
                              <option value=""></option>
                              {["case","sleeve","each","bag","tub","gram","quarter_lb"].map(u=><option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td className="p-2 border">
                            <div className="space-y-1">
                              {Object.entries(i.uom?.toBase||{}).map(([u,per])=>(
                                <div key={u} className="flex items-center gap-2 text-xs">
                                  <span className="w-20">{u}</span><span>=</span>
                                  <input className="w-20 border rounded p-1" inputMode="decimal" value={String(per)}
                                    onChange={e=>{
                                      const n = Number(e.target.value.replace(/[^0-9.]/g,""))||0;
                                      saveItemsBulk(items.map(x=>{
                                        if (x.id!==i.id) return x;
                                        const base=x.uom?.base||"";
                                        const next = { ...(x.uom?.toBase||{}) }; next[u]=n;
                                        return { ...x, uom: base?{ base, toBase: next }:undefined };
                                      }));
                                    }} />
                                  <span>per 1 base</span>
                                  <button className="px-2 py-0.5 rounded border" onClick={()=>{
                                    saveItemsBulk(items.map(x=>{
                                      if (x.id!==i.id) return x;
                                      const base=x.uom?.base||"";
                                      const next = { ...(x.uom?.toBase||{}) }; delete next[u];
                                      return { ...x, uom: base?{ base, toBase: next }:undefined };
                                    }));
                                  }}>remove</button>
                                </div>
                              ))}
                              <button className="px-2 py-0.5 rounded border" onClick={()=>{
                                const uname = prompt("Unit name (e.g., sleeve, each, gram, quarter_lb):","sleeve")||"";
                                if(!uname) return;
                                const per = Number(prompt(`How many "${uname}" in ONE base?`,"0")||"0")||0;
                                saveItemsBulk(items.map(x=>{
                                  if (x.id!==i.id) return x;
                                  const base=x.uom?.base||"";
                                  const next = { ...(x.uom?.toBase||{}) }; next[uname]=Math.max(0,per);
                                  return { ...x, uom: base?{ base, toBase: next }:undefined };
                                }));
                              }}>+ unit</button>
                            </div>
                          </td>
                          <td className="p-2 border">
                            <div className="flex items-center gap-2">
                              <select id={`copy_${i.id}`} className="border rounded p-1 w-40">
                                <option value="">-- choose item --</option>
                                {items.filter(x=>x.id!==i.id).map(x=><option value={x.id} key={x.id}>{x.name}</option>)}
                              </select>
                              <button className="px-2 py-1 rounded border" onClick={()=>{
                                const sel = (document.getElementById(`copy_${i.id}`) as HTMLSelectElement).value;
                                if(!sel) return;
                                copyFrom(sel, i.id, "uom");
                              }}>Copy UOM</button>
                              <button className="px-2 py-1 rounded border" onClick={()=>{
                                const sel = (document.getElementById(`copy_${i.id}`) as HTMLSelectElement).value;
                                if(!sel) return;
                                if(!confirm("Copy ALL attributes (except name) from the selected item onto this one?")) return;
                                copyFrom(sel, i.id, "all");
                              }}>Copy all</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Import / BOM Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-auto" onClick={()=>setShowImport(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-[1100px] p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold">Import Toast CSV · Build BOMs · Prefill</div>
              <button className="px-3 py-1.5 rounded border" onClick={()=>setShowImport(false)}>Close</button>
            </div>

            <div className="mb-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded border cursor-pointer hover:bg-gray-50">
                <span>Choose File</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={e=>{
                  const f = e.target.files?.[0]; if(!f) return;
                  const r = new FileReader();
                  r.onload = ev=>{
                    const txt = String(ev.target?.result||"");
                    const rows = parseCSV(txt);
                    if (!rows.length) { alert("CSV appears empty"); return; }
                    const headers = rows[0]; const body = rows.slice(1).filter(r=>r.some(c=>(c||"").trim()!==""));
                    setCsvHeaders(headers); setCsvRows(body);
                    const m = autoMap(headers); setIdxItem(m.item); setIdxSku(m.sku); setIdxQty(m.qty);
                    if (m.item>=0 && m.qty>=0) recomputeTotals(body,m.item,m.sku,m.qty);
                  };
                  r.readAsText(f);
                }} />
              </label>
            </div>

            {csvHeaders.length>0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Item name column</div>
                  <select className="w-full border rounded p-2" value={idxItem} onChange={e=>{
                    const v=Number(e.target.value); setIdxItem(v); if(v>=0 && idxQty>=0) recomputeTotals(csvRows,v,idxSku,idxQty);
                  }}>
                    <option value={-1}>-- choose --</option>
                    {csvHeaders.map((h,i)=><option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">SKU column (optional)</div>
                  <select className="w-full border rounded p-2" value={idxSku} onChange={e=>{
                    const v=Number(e.target.value); setIdxSku(v); if(idxItem>=0 && idxQty>=0) recomputeTotals(csvRows,idxItem,v,idxQty);
                  }}>
                    <option value={-1}>-- none --</option>
                    {csvHeaders.map((h,i)=><option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Qty sold column</div>
                  <select className="w-full border rounded p-2" value={idxQty} onChange={e=>{
                    const v=Number(e.target.value); setIdxQty(v); if(idxItem>=0 && v>=0) recomputeTotals(csvRows,idxItem,idxSku,v);
                  }}>
                    <option value={-1}>-- choose --</option>
                    {csvHeaders.map((h,i)=><option key={i} value={i}>{h}</option>)}
                  </select>
                </div>
              </div>
            )}

            {Object.keys(soldTotals).length>0 && (
              <div className="text-sm text-gray-700 mb-3">
                Distinct sold items: {Object.keys(soldTotals).length} · Total units: {Object.values(soldTotals).reduce((a,b)=>a+b.qty,0)}
              </div>
            )}

            {/* Missing BOMs */}
            {Object.keys(soldTotals).length>0 && (
              <div className="space-y-3">
                <div className="font-medium">BOMs needed ({Object.values(soldTotals).filter(r=>!getBoms()[r.key]).length} missing)</div>
                <div className="space-y-3">
                  {Object.values(soldTotals).filter(r=>!getBoms()[r.key]).slice(0,8).map(row=>{
                    // mini editor
                    const [type,setType] = React.useState<"drink"|"pastry"|"other">("drink");
                    const [cup,setCup] = React.useState<BomComp>({qty:1,uom:"each"});
                    const [lid,setLid] = React.useState<BomComp>({qty:1,uom:"each"});
                    const [milk,setMilk] = React.useState<BomComp>({qty:0});
                    const [esp,setEsp] = React.useState<BomComp>({qty:0});
                    const [syr,setSyr] = React.useState<BomComp>({qty:0});
                    const [bag,setBag] = React.useState<BomComp>({qty:1,uom:"each"});

                    // auto-pair lid when cup chosen
                    useEffect(()=>{
                      if(!cup.itemId) return;
                      const cname = itemsById[cup.itemId]?.name || "";
                      const guess = suggestLidNameForCup(cname);
                      if (!guess) return;
                      const lidItem = itemsForSlot(items,"lid").find(i=>i.name.toLowerCase()===guess.toLowerCase());
                      if (lidItem) setLid(prev=>({ ...prev, itemId: lidItem.id, uom: (lidItem.uom?.toBase?.each? "each" : lidItem.uom?.base) || "each" }));
                    // eslint-disable-next-line react-hooks/exhaustive-deps
                    },[cup.itemId]);

                    const opts = {
                      cup: itemsForSlot(items,"cup"),
                      lid: itemsForSlot(items,"lid"),
                      milk: itemsForSlot(items,"milk"),
                      espresso: itemsForSlot(items,"espresso"),
                      syrup: itemsForSlot(items,"syrup"),
                      bag: itemsForSlot(items,"bag"),
                    };

                    function unitOptions(id?:string){
                      if(!id) return ["each"];
                      const it = itemsById[id]; if(!it?.uom) return ["each"];
                      const base = it.uom.base; const others = Object.keys(it.uom.toBase||{});
                      return [...others, base];
                    }

                    function saveThis(){
                      const bom: Bom = {
                        key: row.key, name: row.name || row.key, sku: row.sku, type,
                        comps: {
                          cup: type!=="pastry" && cup.itemId ? cup : undefined,
                          lid: type!=="pastry" && lid.itemId ? lid : undefined,
                          milk: type!=="pastry" && milk.itemId ? milk : undefined,
                          espresso: type!=="pastry" && esp.itemId ? esp : undefined,
                          syrup: type!=="pastry" && syr.itemId ? syr : undefined,
                          bag:  type==="pastry" && bag.itemId ? bag : undefined,
                        },
                        updatedAt: new Date().toISOString(),
                      };
                      setBom(bom);
                      alert(`Saved BOM for ${row.name}`);
                      // trigger re-render
                      setSoldTotals({...soldTotals});
                    }

                    return (
                      <div key={row.key} className="border rounded-xl p-3">
                        <div className="text-sm mb-2">
                          <span className="font-medium">{row.name}</span> <span className="text-gray-500">(sold: {row.qty})</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm mb-2">
                          <label className="flex items-center gap-1"><input type="radio" checked={type==="drink"} onChange={()=>setType("drink")} /> Drink</label>
                          <label className="flex items-center gap-1"><input type="radio" checked={type==="pastry"} onChange={()=>setType("pastry")} /> Pastry</label>
                          <label className="flex items-center gap-1"><input type="radio" checked={type==="other"} onChange={()=>setType("other")} /> Other</label>
                        </div>

                        {type!=="pastry" ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Cup */}
                            <div>
                              <div className="text-gray-600 text-sm">Cup</div>
                              <div className="flex gap-2">
                                <select className="border rounded p-2 flex-1" value={cup.itemId||""} onChange={e=>setCup({...cup,itemId:e.target.value})}>
                                  <option value="">-- choose item --</option>
                                  {opts.cup.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <input className="w-20 border rounded p-2" inputMode="decimal" value={String(cup.qty)} onChange={e=>setCup({...cup, qty:Number(e.target.value.replace(/[^0-9.]/g,""))||0})}/>
                                <select className="w-28 border rounded p-2" value={cup.uom||""} onChange={e=>setCup({...cup,uom:e.target.value||undefined})}>
                                  <option value="">base</option>
                                  {unitOptions(cup.itemId).map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>
                            {/* Lid */}
                            <div>
                              <div className="text-gray-600 text-sm">Lid</div>
                              <div className="flex gap-2">
                                <select className="border rounded p-2 flex-1" value={lid.itemId||""} onChange={e=>setLid({...lid,itemId:e.target.value})}>
                                  <option value="">-- choose item --</option>
                                  {opts.lid.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <input className="w-20 border rounded p-2" inputMode="decimal" value={String(lid.qty)} onChange={e=>setLid({...lid, qty:Number(e.target.value.replace(/[^0-9.]/g,""))||0})}/>
                                <select className="w-28 border rounded p-2" value={lid.uom||""} onChange={e=>setLid({...lid,uom:e.target.value||undefined})}>
                                  <option value="">base</option>
                                  {unitOptions(lid.itemId).map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>
                            {/* Milk */}
                            <div>
                              <div className="text-gray-600 text-sm">Milk</div>
                              <div className="flex gap-2">
                                <select className="border rounded p-2 flex-1" value={milk.itemId||""} onChange={e=>setMilk({...milk,itemId:e.target.value})}>
                                  <option value="">-- choose item --</option>
                                  {opts.milk.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <input className="w-20 border rounded p-2" inputMode="decimal" value={String(milk.qty)} onChange={e=>setMilk({...milk, qty:Number(e.target.value.replace(/[^0-9.]/g,""))||0})}/>
                                <select className="w-28 border rounded p-2" value={milk.uom||""} onChange={e=>setMilk({...milk,uom:e.target.value||undefined})}>
                                  <option value="">base</option>
                                  {unitOptions(milk.itemId).map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>
                            {/* Espresso */}
                            <div>
                              <div className="text-gray-600 text-sm">Espresso/Coffee</div>
                              <div className="flex gap-2">
                                <select className="border rounded p-2 flex-1" value={esp.itemId||""} onChange={e=>setEsp({...esp,itemId:e.target.value})}>
                                  <option value="">-- choose item --</option>
                                  {opts.espresso.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <input className="w-20 border rounded p-2" inputMode="decimal" value={String(esp.qty)} onChange={e=>setEsp({...esp, qty:Number(e.target.value.replace(/[^0-9.]/g,""))||0})}/>
                                <select className="w-28 border rounded p-2" value={esp.uom||""} onChange={e=>setEsp({...esp,uom:e.target.value||undefined})}>
                                  <option value="">base</option>
                                  {unitOptions(esp.itemId).map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>
                            {/* Syrup */}
                            <div>
                              <div className="text-gray-600 text-sm">Syrup</div>
                              <div className="flex gap-2">
                                <select className="border rounded p-2 flex-1" value={syr.itemId||""} onChange={e=>setSyr({...syr,itemId:e.target.value})}>
                                  <option value="">-- choose item --</option>
                                  {opts.syrup.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <input className="w-20 border rounded p-2" inputMode="decimal" value={String(syr.qty)} onChange={e=>setSyr({...syr, qty:Number(e.target.value.replace(/[^0-9.]/g,""))||0})}/>
                                <select className="w-28 border rounded p-2" value={syr.uom||""} onChange={e=>setSyr({...syr,uom:e.target.value||undefined})}>
                                  <option value="">base</option>
                                  {unitOptions(syr.itemId).map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <div className="text-gray-600 text-sm">Bag</div>
                              <div className="flex gap-2">
                                <select className="border rounded p-2 flex-1" value={bag.itemId||""} onChange={e=>setBag({...bag,itemId:e.target.value})}>
                                  <option value="">-- choose item --</option>
                                  {opts.bag.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
                                </select>
                                <input className="w-20 border rounded p-2" inputMode="decimal" value={String(bag.qty)} onChange={e=>setBag({...bag, qty:Number(e.target.value.replace(/[^0-9.]/g,""))||0})}/>
                                <select className="w-28 border rounded p-2" value={bag.uom||""} onChange={e=>setBag({...bag,uom:e.target.value||undefined})}>
                                  <option value="">base</option>
                                  {unitOptions(bag.itemId).map(u=><option key={u} value={u}>{u}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-3">
                          <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={saveThis}>Save BOM</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {Object.values(soldTotals).filter(r=>!getBoms()[r.key]).length>8 && (
                  <div className="text-sm text-gray-600">…save these and more will appear.</div>
                )}
              </div>
            )}

            {Object.keys(soldTotals).length>0 && (
              <div className="mt-4 flex gap-2">
                <button className="px-3 py-2 rounded border" onClick={applyPrefillToToday}>Apply Prefill to Today’s Run</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

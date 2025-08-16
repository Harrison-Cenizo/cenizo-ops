'use client';

import React, { useEffect, useMemo, useState } from 'react';

/* =======================================================================
   Types
   ======================================================================= */
type Location = { group: string; name: string; key: string };
type Uom = { base: string; toBase: Record<string, number> }; // childUnit -> per 1 base
type MakeBuy = 'make' | 'buy';
type Item = {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  supplier?: string;
  orderMultiple?: number;
  sku?: string;
  makeOrBuy?: MakeBuy;
  locations: string[];
  uom?: Uom;
  par?: Record<string, number>;      // saved in BASE units per location
  parUnit?: Record<string, string>;  // preferred UOM display per location
};
type RunLine = { itemId: string; name: string; unit?: string; qty: number }; // qty in BASE units
type RunState = {
  runId: string;
  group: string;
  locationKey: string;
  locationName: string;
  dateLocalISO: string;
  index: number;
  items: RunLine[];
  by?: string;
  startedAt?: string;
  completedAt?: string;
};

type BomComp = { itemId?: string; qty: number; uom?: string };
type Bom = {
  key: string; name: string; sku?: string; type: 'drink'|'pastry'|'other';
  comps: { cup?: BomComp; lid?: BomComp; milk?: BomComp; espresso?: BomComp; syrup?: BomComp; bag?: BomComp };
  updatedAt: string;
};

/* =======================================================================
   Constants / Storage helpers
   ======================================================================= */
const LOCATIONS: Location[] = [
  { group: 'Cenizo', name: 'Easton Park',     key: 'Cenizo:Easton Park' },
  { group: 'Cenizo', name: 'Del Valle',       key: 'Cenizo:Del Valle' },
  { group: 'Sano Market', name: 'Easton Park',key: 'Sano Market:Easton Park' },
  { group: 'Warehouse', name: 'Old Lockhart', key: 'Other:Old Lockhart' },
  { group: 'Warehouse', name: 'Chrysler Bend',key: 'Other:Chrysler Bend' },
];
const WAREHOUSE_KEYS = new Set(['Other:Old Lockhart','Other:Chrysler Bend']);

const LS_RUNS      = 'cenizo-inventory-runs-v1';
const LS_ITEMS     = 'cenizo-inventory-custom-items-v1';
const LS_OVERRIDES = 'cenizo-inventory-item-overrides-v1';
const LS_HIDDEN    = 'cenizo-inventory-hidden-item-ids-v1';
const LS_BOMS      = 'cenizo-inventory-boms-v1';
const LS_UOMCHOICE = 'cenizo-inventory-uom-choice-v1';

const SLUG = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

const jsonGet = <T,>(k: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
};
const jsonSet = (k: string, v: any) => localStorage.setItem(k, JSON.stringify(v));

const byGroup = (g: string) => LOCATIONS.filter(l => l.group === g);
const todayLocalISO = () => {
  const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
};
const runIdFor = (locKey: string) => `${locKey}__${todayLocalISO()}`;

/* =======================================================================
   SKU helpers
   ======================================================================= */
const CAT_PREFIX: Record<string,string> = {
  'Cups':'CUPS', 'Lids':'LIDS', 'House Syrups':'SYR', 'Syrups':'SYR',
  'Milk':'MILK', 'Misc Bev':'MISC', 'Packaging':'PKG', 'Prepped Bev':'PREP',
  'Retail':'RTL', 'Bev Supplies':'BSUP', 'Cleaning Supplies':'CLEAN',
  'Consumables':'CONS', 'Tea':'TEA', 'Ingredients':'ING',
  'Supplies':'SUP', 'Beverage Base':'BB'
};
const SKU_FROM = (cat: string|undefined, name: string) => {
  const pref = CAT_PREFIX[cat||''] || 'GEN';
  const code = SLUG(name).toUpperCase().replace(/-/g,'').slice(0,10);
  return `${pref}-${code}`;
};

/* =======================================================================
   Seed items (your list, + default sku + default make/buy)
   ======================================================================= */
const RAW_SEEDS: Array<{ family: string; item: string }> = [
  { family:'Coffee Bulk', item:'Talisman (Espresso)' },
  { family:'Cups', item:'4oz sample' }, { family:'Cups', item:'8oz Hot' }, { family:'Cups', item:'12oz Hot' },
  { family:'Cups', item:'16oz Hot' }, { family:'Cups', item:'12oz Cold' }, { family:'Cups', item:'16oz Cold' },
  { family:'House Syrups', item:'Cafe De Olla' }, { family:'House Syrups', item:'Churro' }, { family:'House Syrups', item:'Vanilla' }, { family:'House Syrups', item:'Honey Lavendar' },
  { family:'House Syrups', item:'Simple' }, { family:'House Syrups', item:'SF Vanilla' }, { family:'House Syrups', item:'Honey' },
  { family:'Lids', item:'Cold Sipper' }, { family:'Lids', item:'8oz Hot Sipper' }, { family:'Lids', item:'12/16 Hot Sipper' },
  { family:'Milk', item:'Whole' }, { family:'Milk', item:'Almond' }, { family:'Milk', item:'Oat' }, { family:'Milk', item:'Heavy Whipping Cream' }, { family:'Milk', item:'1/2 & 1/2' },
  { family:'Misc Bev', item:'Liquid Death' }, { family:'Misc Bev', item:'Juice Boxes' }, { family:'Misc Bev', item:'Sparkling Water' }, { family:'Misc Bev', item:'Hot Cocoa Mix' },
  { family:'Packaging', item:'Paper Bags w/ Handle' },
  { family:'Prepped Bev', item:'Horchata Blended' }, { family:'Prepped Bev', item:'Horchata Steeping' }, { family:'Prepped Bev', item:'Hibby Hollow Iced Tea' }, { family:'Prepped Bev', item:'Cold Brew Concentrate' },
  { family:'Syrups', item:'Dark Chocolate Sauce' }, { family:'Syrups', item:'White Chocolate Sauce' },
  { family:'Retail', item:'THC Sativa Gummies' }, { family:'Retail', item:'THC Indica Gummies' }, { family:'Retail', item:'THC Hybrid Gummies' },
  { family:'Bev Supplies', item:'Coffee Filters' }, { family:'Bev Supplies', item:'Tea Bags' }, { family:'Bev Supplies', item:'Hot Cup Sleeves' },
  { family:'Cleaning Supplies', item:'Compost Bags' }, { family:'Cleaning Supplies', item:'Microfiber Towels' }, { family:'Cleaning Supplies', item:'Sanitizer' }, { family:'Cleaning Supplies', item:'Dish Soap' },
  { family:'Cleaning Supplies', item:'Hand Wash Soap' }, { family:'Cleaning Supplies', item:'Floor Cleaner' }, { family:'Cleaning Supplies', item:'Cafiza' }, { family:'Cleaning Supplies', item:'Tabz Coffee Tablets' },
  { family:'Cleaning Supplies', item:'Dairy Cleaner' }, { family:'Cleaning Supplies', item:'Grindz tablets' }, { family:'Cleaning Supplies', item:'Trash Bags' }, { family:'Cleaning Supplies', item:'Sponges' },
  { family:'Cleaning Supplies', item:'Black Gloves' }, { family:'Cleaning Supplies', item:'Dish Brushes' }, { family:'Cleaning Supplies', item:'Dish Gloves' },
  { family:'Coffee Bulk', item:'Decaf Vienna' }, { family:'Coffee Bulk', item:'Lonestar Blend (Cold Brew)' }, { family:'Coffee Bulk', item:'Victory (Drip)' },
  { family:'Consumables', item:'Straws' }, { family:'Consumables', item:'Cenizo Drink Stickers' }, { family:'Consumables', item:'Drink Stoppers' }, { family:'Consumables', item:'Sugar Packets' },
  { family:'Consumables', item:'Stevia Packets' }, { family:'Consumables', item:'Cinnamon Powder' }, { family:'Consumables', item:'Wooden Stir Sticks' }, { family:'Consumables', item:'Cup Carriers' },
  { family:'Consumables', item:'Customer Napkins' }, { family:'Consumables', item:'Handwash Paper Towels' }, { family:'Consumables', item:'White Paper Towels' },
  { family:'Consumables', item:'Receipt Paper' }, { family:'Consumables', item:'Sharpies' }, { family:'Consumables', item:'Expo' }, { family:'Consumables', item:'AAA batteries' },
  { family:'Consumables', item:'AA batteries' }, { family:'Consumables', item:'Dog Treats' },
  { family:'Packaging', item:'Pastry Bags' },
  { family:'Retail', item:'Cenizo Dark Roast' }, { family:'Retail', item:'Cenizo Blend' }, { family:'Retail', item:'Cenizo Retail Stickers' },
  { family:'Syrups', item:'Monin Hazelnut' }, { family:'Syrups', item:'Monin Caramel' }, { family:'Syrups', item:'Monin SF Caramel' }, { family:'Syrups', item:'Monin Mango' }, { family:'Syrups', item:'Monin Raspberry' }, { family:'Syrups', item:'Monin Blackberry' },
  { family:'syrups', item:'Monin Watermelon' },
  { family:'Tea', item:'Matcha' }, { family:'Tea', item:'Chai' }, { family:'Tea', item:'Earl Gray' }, { family:'Tea', item:'Chamomile' }, { family:'Tea', item:'Hibby Hollow' }, { family:'Tea', item:'Strawberry Peach' },
  { family:'Ingredients', item:'Piloncillo' }, { family:'Ingredients', item:'Honey' }, { family:'Ingredients', item:'Vanilla' }, { family:'Ingredients', item:'Sugar' }, { family:'Ingredients', item:'Rice' }, { family:'Ingredients', item:'Oranges' },
  { family:'Ingredients', item:'Cinnamon Sticks' }, { family:'Ingredients', item:'Lavender' }, { family:'Ingredients', item:'Brown Sugar' }, { family:'Ingredients', item:'Evaporated Milk' },
  { family:'Ingredients', item:'Sweetened Condensed' }, { family:'Ingredients', item:'Stevia' }, { family:'Ingredients', item:'Pink Salt' },
  { family:'Supplies', item:'Sanitizer Test Strips' },
];

// default make/buy by category
const DEFAULT_MAKE: Record<string, MakeBuy> = {
  'House Syrups':'make',
  'Prepped Bev':'make',
};

const SEEDS: Item[] = RAW_SEEDS.map(({ family, item }) => {
  const cat = (family === 'Tea' || family === 'Coffee Bulk') ? 'Beverage Base' : family;
  const id = `seed-${SLUG(cat)}-${SLUG(item)}`;
  const allLocs = LOCATIONS.map(l => l.key);
  const baseUom: Uom | undefined =
    cat === 'Cups' || cat === 'Lids'       ? { base: 'case', toBase: {} } :
    cat === 'House Syrups' || cat === 'Syrups' ? { base: 'case', toBase: {} } :
    cat === 'Beverage Base'               ? { base: 'bag',  toBase: {} } :
    cat === 'Milk'                        ? { base: 'each', toBase: {} } : undefined;

  return {
    id,
    name: item,
    category: cat,
    uom: baseUom,
    sku: SKU_FROM(cat, item),
    makeOrBuy: DEFAULT_MAKE[cat] || 'buy',
    locations: allLocs
  };
});

/* =======================================================================
   Items + Runs loaders
   ======================================================================= */
function allItems(): Item[] {
  const hidden = new Set(jsonGet<string[]>(LS_HIDDEN, []));
  const custom = jsonGet<Item[]>(LS_ITEMS, []);
  const overrides = jsonGet<Record<string, Partial<Item>>>(LS_OVERRIDES, {});
  const base = [...SEEDS, ...custom].filter(i => !hidden.has(i.id));
  return base.map(i => {
    const ov = overrides[i.id];
    if (!ov) return i;
    return {
      ...i,
      ...ov,
      locations: ov.locations ? ov.locations.slice() : i.locations,
      par: ov.par ? { ...(i.par || {}), ...ov.par } : i.par,
      parUnit: ov.parUnit ? { ...(i.parUnit || {}), ...ov.parUnit } : i.parUnit,
      uom: ov.uom
        ? { base: ov.uom.base || i.uom?.base || 'each', toBase: { ...(i.uom?.toBase || {}), ...(ov.uom?.toBase || {}) } }
        : i.uom,
    } as Item;
  });
}
const itemsForLocation = (key: string) => allItems().filter(i => i.locations.includes(key)).sort((a,b)=>a.name.localeCompare(b.name));
const itemsById = () => { const m:Record<string,Item>={}; allItems().forEach(i=>m[i.id]=i); return m; };

const loadRuns = () => jsonGet<Record<string, RunState>>(LS_RUNS, {});
const saveRun  = (r: RunState) => { const all = loadRuns(); all[r.runId] = r; jsonSet(LS_RUNS, all); };
const getRunForLocation = (key: string) => loadRuns()[runIdFor(key)] || null;

/* =======================================================================
   UOM helpers
   ======================================================================= */
const unitsForItem = (it?: Item): string[] => {
  if (!it?.uom) return ['each'];
  const kids = Object.keys(it.uom.toBase || {});
  const ordered = [...kids.sort((a,b)=>a.localeCompare(b)), it.uom.base];
  const seen = new Set<string>(); const arr:string[]=[];
  for (const u of ordered) { if (!seen.has(u)) { seen.add(u); arr.push(u); } }
  return arr.length?arr:['each'];
};
const toBaseQty = (it: Item | undefined, qty: number, unit: string): number => {
  if (!it?.uom) return qty;
  if (unit === it.uom.base) return qty;
  const per = it.uom.toBase[unit];
  if (!per || per === 0) return qty;
  return qty / per;
};
const fromBaseQty = (it: Item | undefined, qtyBase: number, unit: string): number => {
  if (!it?.uom) return qtyBase;
  if (unit === it.uom.base) return qtyBase;
  const per = it.uom.toBase[unit];
  if (!per || per === 0) return qtyBase;
  return qtyBase * per;
};
const roundForDisplay = (n: number) => (Math.round(n * 100) / 100);

/* =======================================================================
   Sync run with current master item list
   ======================================================================= */
function syncRunWithMaster(run: RunState): RunState {
  const master = itemsForLocation(run.locationKey);
  const byId: Record<string, RunLine> = {}; run.items.forEach(l => byId[l.itemId]=l);

  const merged: RunLine[] = master.map(m => {
    const ex = byId[m.id];
    if (ex) {
      if (ex.name === m.name && (ex.unit||'') === (m.unit||'')) return ex;
      return { ...ex, name: m.name, unit: m.unit };
    }
    return { itemId: m.id, name: m.name, unit: m.unit, qty: 0 };
  });

  const same = merged.length === run.items.length &&
    merged.every((it,i) => {
      const r = run.items[i];
      return it === r || (it.itemId===r.itemId && it.name===r.name && (it.unit||'')===(r.unit||'') && (it.qty??0)===(r.qty??0));
    });

  const newIndex = Math.min(merged.length-1, Math.max(0, run.index));
  if (same && newIndex === run.index) return run;
  if (same) return { ...run, index: newIndex };
  return { ...run, items: merged, index: newIndex };
}

/* =======================================================================
   Page
   ======================================================================= */
export default function InventoryPage() {
  // top-level hooks only (never behind conditionals)
  const [group, setGroup] = useState<string>('Cenizo');
  const groupLocs = useMemo(()=>byGroup(group),[group]);
  const [location, setLocation] = useState<Location|null>(groupLocs[0]||null);

  const [run, setRun] = useState<RunState|null>(null);
  const [qtyInput, setQtyInput] = useState<string>('');

  const [showManage, setShowManage] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showPars, setShowPars] = useState(false);
  const [showPicklist, setShowPicklist] = useState(false);
  const [showOrder, setShowOrder] = useState(false);

  // chosen counting UOM per item/location
  const [uomChoice, setUomChoice] = useState<Record<string, string>>(
    () => jsonGet<Record<string,string>>(LS_UOMCHOICE, {})
  );

  // Quick Jump filter state
  const allCategories = useMemo(
    () => Array.from(new Set(allItems().map(i=>i.category||'').filter(Boolean))).sort(),
    []
  );
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');

  // compute quick list unconditionally so hooks order never changes
  const quickList = useMemo(() => {
    if (!run) return [];
    const term = search.trim().toLowerCase();
    const wantedCat = catFilter;
    const idMapLocal = itemsById();
    return run.items
      .map((l, idx) => {
        const it = idMapLocal[l.itemId];
        return { idx, name: l.name, cat: it?.category || '' };
      })
      .filter(x => (wantedCat==='all' ? true : x.cat === wantedCat))
      .filter(x => (term ? x.name.toLowerCase().includes(term) : true));
  }, [run, search, catFilter]);

  useEffect(() => { if (!location && groupLocs.length) setLocation(groupLocs[0]); }, [groupLocs, location]);

  useEffect(() => {
    if (!run) return;
    const it = itemsById()[run.items[run.index]?.itemId];
    const unit = uomChoice[`${run.locationKey}|${it?.id}`] || (it ? (unitsForItem(it)[0] || 'each') : 'each');
    const qBase = run.items[run.index]?.qty || 0;
    setQtyInput(String(roundForDisplay(fromBaseQty(it, qBase, unit))));
  }, [run]); // eslint-disable-line

  function startOrResume() {
    if (!location) return;
    const rid = runIdFor(location.key);
    const all = loadRuns();
    const existing = all[rid];
    if (existing) {
      const synced = syncRunWithMaster(existing); saveRun(synced); setRun(synced); return;
    }
    const lines = itemsForLocation(location.key).map(i => ({ itemId: i.id, name: i.name, unit: i.unit, qty: 0 }));
    const r: RunState = {
      runId: rid, group: location.group, locationKey: location.key, locationName: location.name,
      dateLocalISO: todayLocalISO(), index: 0, items: lines, startedAt: new Date().toISOString()
    };
    saveRun(r); setRun(r);
  }

  function commitQtyDisplay(val: number) {
    if (!run) return;
    const idx = run.index;
    const line = run.items[idx];
    const it = itemsById()[line.itemId];
    const unit = uomChoice[`${run.locationKey}|${it?.id}`] || (it ? (unitsForItem(it)[0] || 'each') : 'each');
    const base = Math.max(0, Math.floor(toBaseQty(it, val, unit)));
    const next = { ...run, items: run.items.map((l,i)=> i===idx ? ({ ...l, qty: base }) : l) };
    setRun(next); saveRun(next);
    setQtyInput(String(roundForDisplay(val)));
  }

  const goPrev = () => { if (!run) return; const s = syncRunWithMaster(run); const n = { ...s, index: Math.max(0, s.index-1) }; setRun(n); saveRun(n); };
  const goNext = () => { if (!run) return; const s = syncRunWithMaster(run); const n = { ...s, index: Math.min(s.items.length-1, s.index+1) }; setRun(n); saveRun(n); };

  function jumpTo(index:number) {
    if (!run) return;
    const s = syncRunWithMaster(run);
    const idx = Math.min(Math.max(0,index), s.items.length-1);
    const n = { ...s, index: idx };
    setRun(n); saveRun(n);
  }

  // ----- pre-run view -----
  if (!run) {
    const items = allItems();
    const cats = Array.from(new Set(items.map(i=>i.category||'').filter(Boolean))).sort();
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Inventory</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Business</label>
            <select className="w-full border rounded p-2" value={group} onChange={e=>setGroup(e.target.value)}>
              {Array.from(new Set(LOCATIONS.map(l=>l.group))).map(g=><option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Location</label>
            <select className="w-full border rounded p-2" value={location?.key||''} onChange={e=>setLocation(groupLocs.find(l=>l.key===e.target.value)||null)}>
              {groupLocs.map(l => <option key={l.key} value={l.key}>{`${l.group}: ${l.name}`}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 rounded bg-indigo-600 text-white" onClick={startOrResume}>Start / Resume Count</button>
          <button className="px-4 py-2 rounded border" onClick={()=>setShowAdd(true)}>Add Item</button>
          <button className="px-4 py-2 rounded border" onClick={()=>setShowManage(true)}>Manage Items</button>
          <button className="px-4 py-2 rounded border" onClick={()=>setShowPars(true)}>PAR Sheet</button>
          <button className="px-4 py-2 rounded border" onClick={()=>setShowPicklist(true)}>Picklist (CSV)</button>
          <button className="px-4 py-2 rounded border" onClick={()=>setShowOrder(true)}>Order List (CSV)</button>
          <button className="px-4 py-2 rounded border" onClick={()=>setShowImport(true)}>Import Toast CSV (BOM + Prefill)</button>
        </div>

        {showManage && <ManageModal onClose={()=>setShowManage(false)} />}
        {showImport && <ImportModal onClose={()=>setShowImport(false)} currentLocationKey={location?.key||''} />}
        {showAdd && <AddModal onClose={()=>setShowAdd(false)} defaultLocation={location?.key} />}
        {showPars && <ParsModal onClose={()=>setShowPars(false)} />}
        {showPicklist && <PicklistModal onClose={()=>setShowPicklist(false)} getPar={getParBase} onHandBase={onHandBase} />}
        {showOrder && <OrderModal onClose={()=>setShowOrder(false)} getPar={getParBase} onHandBase={onHandBase} />}
      </div>
    );
  }

  // ----- run view -----
  const cur = run.items[run.index];
  const total = run.items.length;
  const idMap = itemsById();
  const curItem = idMap[cur.itemId];
  const units = unitsForItem(curItem);
  const choiceKey = `${run.locationKey}|${curItem?.id}`;
  const chosenUom = uomChoice[choiceKey] || (curItem ? units[0] : 'each');

  const overrides = jsonGet<Record<string, Partial<Item>>>(LS_OVERRIDES, {});
  const parBase = overrides[cur.itemId]?.par?.[run.locationKey] ?? 0;

  const onHandDisplay = roundForDisplay(fromBaseQty(curItem, cur.qty, chosenUom));
  const parDisplay     = roundForDisplay(fromBaseQty(curItem, parBase, chosenUom));
  const needDisplay    = Math.max(0, roundForDisplay(parDisplay - onHandDisplay));
  const suggestedOrderDisplay = (() => {
    const mult = curItem?.orderMultiple || 1;
    const needBase = Math.max(0, parBase - cur.qty);
    const roundedBase = Math.ceil(needBase / mult) * mult;
    return roundForDisplay(fromBaseQty(curItem, roundedBase, chosenUom));
  })();

  function setChoice(u: string) {
    const next = { ...uomChoice, [choiceKey]: u };
    setUomChoice(next); jsonSet(LS_UOMCHOICE, next);
    setQtyInput(String(roundForDisplay(fromBaseQty(curItem, cur.qty, u))));
  }

  const exportCSV = (r: RunState) => {
    const lines: string[] = [];
    lines.push(['Item ID','Item Name','Unit','Quantity (base)'].join(','));
    r.items.forEach(l => lines.push([l.itemId, l.name.replace(/"/g,'""'), l.unit||'', String(l.qty)].map(v=>`"${v}"`).join(',')));
    const blob = new Blob([lines.join('\n')], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `inventory_${r.locationKey.replace(/[^a-z0-9]+/gi,'-')}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),500);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">{run.group} — {run.locationName}</div>
          <h1 className="text-2xl font-semibold">{cur?.name || '—'}</h1>
          <div className="text-xs text-gray-500">{new Date(run.dateLocalISO).toLocaleDateString()}</div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded border" onClick={()=>setShowManage(true)}>Manage Items</button>
          <button className="px-3 py-1.5 rounded border" onClick={()=>setShowPars(true)}>PAR Sheet</button>
          <button className="px-3 py-1.5 rounded border" onClick={()=>setShowPicklist(true)}>Picklist</button>
          <button className="px-3 py-1.5 rounded border" onClick={()=>setShowOrder(true)}>Order List</button>
        </div>
      </div>

      {/* Quick Jump toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Search items</label>
            <input
              className="w-full border rounded p-2"
              placeholder="Type to filter; Enter to jump to first result"
              value={search}
              onChange={e=>setSearch(e.target.value)}
              onKeyDown={e=>{ if (e.key==='Enter' && quickList.length>0) jumpTo(quickList[0].idx); }}
            />
          </div>
          <div className="w-56">
            <label className="block text-xs text-gray-500 mb-1">Category</label>
            <select className="w-full border rounded p-2" value={catFilter} onChange={e=>setCatFilter(e.target.value)}>
              <option value="all">all</option>
              {allCategories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-end justify-end gap-2">
          <span className="text-xs text-gray-500 self-center">Count in</span>
          <select className="border rounded p-2" value={chosenUom} onChange={e=>setChoice(e.target.value)}>
            {units.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-6">
        <div className="rounded-2xl border overflow-hidden">
          <div className="px-4 py-2 border-b text-sm text-gray-600">Item {run.index + 1} of {total}</div>
          <div className="p-4 space-y-4">
            <input
              type="number"
              inputMode="decimal"
              className="w-full border rounded-xl p-3 text-2xl"
              placeholder="0"
              value={qtyInput}
              onChange={e=>setQtyInput(e.target.value)}
              onBlur={()=>commitQtyDisplay(Number(qtyInput || 0))}
            />
            <div className="flex flex-wrap gap-2">
              <button className="px-3 py-2 rounded border" onClick={()=>commitQtyDisplay(Math.max(0, Number(qtyInput||0) - 5))}>-5</button>
              <button className="px-3 py-2 rounded border" onClick={()=>commitQtyDisplay(Math.max(0, Number(qtyInput||0) - 1))}>-1</button>
              <button className="px-3 py-2 rounded border" onClick={()=>commitQtyDisplay(0)}>Set 0</button>
              <button className="px-3 py-2 rounded border" onClick={()=>commitQtyDisplay(Number(qtyInput||0) + 1)}>+1</button>
              <button className="px-3 py-2 rounded border" onClick={()=>commitQtyDisplay(Number(qtyInput||0) + 5)}>+5</button>
            </div>

            <div className="rounded bg-gray-50 p-3 text-sm grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">On hand:</span> <b>{onHandDisplay}</b> {chosenUom}</div>
              <div><span className="text-gray-500">PAR:</span> <b>{parDisplay}</b> {chosenUom}</div>
              <div><span className="text-gray-500">Need:</span> <b>{needDisplay}</b> {chosenUom}</div>
              <div><span className="text-gray-500">Suggested order:</span> <b>{suggestedOrderDisplay}</b> {chosenUom}</div>
            </div>

            <div className="flex items-center justify-between">
              <button className="px-4 py-2 rounded border" disabled={run.index===0} onClick={goPrev}>Prev</button>
              <button className="px-4 py-2 rounded bg-blue-600 text-white" disabled={run.index>=total-1} onClick={goNext}>Save & Next</button>
            </div>
          </div>
        </div>

        {/* Quick List */}
        <div className="rounded-2xl border p-3">
          <div className="text-sm font-medium mb-2">Quick List</div>
          <ul className="max-h-[420px] overflow-auto divide-y">
            {quickList.map(q => (
              <li
                key={q.idx}
                className={`px-3 py-2 text-sm cursor-pointer ${q.idx===run.index ? 'bg-indigo-50 font-medium' : 'hover:bg-gray-50'}`}
                onClick={()=>jumpTo(q.idx)}
                title={`Jump to ${q.name}`}
              >
                {q.name}
              </li>
            ))}
            {quickList.length===0 && <li className="px-3 py-2 text-sm text-gray-500">No matches</li>}
          </ul>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="px-4 py-2 rounded border" onClick={()=>exportCSV(run)}>Export CSV (this location)</button>
        <button className="px-4 py-2 rounded border" onClick={()=>{
          if (!confirm('Reset today’s count to zero for this location?')) return;
          const fresh = { ...run, items: run.items.map(l=>({ ...l, qty:0 })), index:0, startedAt:new Date().toISOString(), completedAt:undefined };
          setRun(fresh); saveRun(fresh); setQtyInput('');
        }}>Reset Today</button>
      </div>

      {showManage && <ManageModal onClose={()=>setShowManage(false)} />}
      {showAdd && <AddModal onClose={()=>setShowAdd(false)} defaultLocation={run.locationKey} />}
      {showImport && <ImportModal onClose={()=>setShowImport(false)} currentLocationKey={run.locationKey} />}
      {showPars && <ParsModal onClose={()=>setShowPars(false)} />}
      {showPicklist && <PicklistModal onClose={()=>setShowPicklist(false)} getPar={getParBase} onHandBase={onHandBase} />}
      {showOrder && <OrderModal onClose={()=>setShowOrder(false)} getPar={getParBase} onHandBase={onHandBase} />}
    </div>
  );
}

/* =======================================================================
   Helpers for picklist/order (base units)
   ======================================================================= */
function getParBase(itemId: string, locKey: string): number {
  const ov = jsonGet<Record<string, Partial<Item>>>(LS_OVERRIDES, {});
  return ov[itemId]?.par?.[locKey] ?? 0;
}
function onHandBase(itemId: string, locKey: string): number {
  const r = getRunForLocation(locKey);
  return r?.items.find(l=>l.itemId===itemId)?.qty || 0;
}

/* =======================================================================
   Manage Items, Add Item, Import/BOM, Pars, Picklist, Order
   ======================================================================= */
function ManageModal({ onClose }: { onClose: () => void }) {
  const originals = allItems();
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('all');
  const cats = Array.from(new Set(originals.map(i=>i.category||'').filter(Boolean))).sort();
  const view = originals
    .filter(i => (category === 'all' ? true : (i.category||'')===category))
    .filter(i => i.name.toLowerCase().includes(filter.toLowerCase()));
  const [draft, setDraft] = useState<Record<string, Partial<Item>>>({});

  function change(id: string, partial: Partial<Item>) {
    setDraft(d => ({ ...d, [id]: { ...(d[id]||{}), ...partial } }));
  }
  function addUnit(id: string) {
    const cur = (draft[id]?.uom || originals.find(x=>x.id===id)?.uom || { base:'each', toBase:{} });
    const name = window.prompt('Smallest unit name (e.g., each, sleeve, gram):','each');
    if (!name) return;
    const per = Number(window.prompt(`How many "${name}" in ONE "${cur.base}"?`,'0')||'0');
    change(id, { uom: { base: cur.base, toBase: { ...(cur.toBase||{}), [name]: Math.max(0, per) } } });
  }
  function removeUnit(id: string, uname: string) {
    const cur = (draft[id]?.uom || originals.find(x=>x.id===id)?.uom || { base:'each', toBase:{} });
    const next = { ...(cur.toBase||{}) }; delete next[uname];
    change(id, { uom: { base: cur.base, toBase: next } });
  }
  function saveAll() {
    const ov = jsonGet<Record<string, Partial<Item>>>(LS_OVERRIDES, {});
    Object.keys(draft).forEach(id => {
      const d = draft[id];
      ov[id] = {
        ...ov[id],
        ...d,
        uom: d.uom ? { base: d.uom.base || ov[id]?.uom?.base || 'each', toBase: d.uom.toBase || ov[id]?.uom?.toBase || {} } : ov[id]?.uom,
      };
    });
    jsonSet(LS_OVERRIDES, ov);
    alert('Saved.'); onClose();
  }
  function copyFrom(srcId: string, dstId: string, mode: 'uom'|'all') {
    const src = originals.find(x=>x.id===srcId); if (!src) return;
    const dst = draft[dstId] || {};
    if (mode==='uom') {
      change(dstId, { ...dst, uom: src.uom ? { base: src.uom.base, toBase: { ...src.uom.toBase } } : undefined });
    } else {
      // Copy operational attributes ONLY (no name/category/description)
      change(dstId, {
        supplier: src.supplier,
        orderMultiple: src.orderMultiple,
        sku: src.sku,
        uom: src.uom ? { base: src.uom.base, toBase: { ...src.uom.toBase } } : undefined,
        makeOrBuy: src.makeOrBuy
      });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center p-6">
      <div className="bg-white w-[min(1280px,95vw)] rounded-2xl shadow-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">Manage Items</div>
          <div className="flex gap-2"><button className="px-3 py-1.5 rounded border" onClick={onClose}>Back</button><button className="px-3 py-1.5 rounded bg-indigo-600 text-white" onClick={saveAll}>Save All</button></div>
        </div>
        <div className="flex gap-3 mb-3">
          <input className="border rounded p-2 w-64" placeholder="Search…" value={filter} onChange={e=>setFilter(e.target.value)} />
          <select className="border rounded p-2" value={category} onChange={e=>setCategory(e.target.value)}>
            <option value="all">all</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Category</th>
                <th className="p-2 border">SKU</th>
                <th className="p-2 border">Supplier</th>
                <th className="p-2 border">OM</th>
                <th className="p-2 border">UOM Base</th>
                <th className="p-2 border">Units (per 1 base)</th>
                <th className="p-2 border">Make/Buy</th>
                <th className="p-2 border">Copy from</th>
              </tr>
            </thead>
            <tbody>
              {view.map(it => {
                const ov = draft[it.id] || {};
                const cur: Item = { ...it, ...ov, uom: ov.uom ? ov.uom : it.uom };
                const categories = Array.from(new Set(allItems().map(i => i.category || '').filter(Boolean))).sort();
                return (
                  <tr key={it.id}>
                    <td className="p-2 border"><input className="w-56 border rounded p-1" defaultValue={it.name} onChange={e=>change(it.id,{name:e.target.value})} /></td>
                    <td className="p-2 border">
                      <select className="w-40 border rounded p-1" defaultValue={it.category || ''} onChange={e=>change(it.id,{category:e.target.value})}>
                        <option value="">—</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="p-2 border"><input className="w-32 border rounded p-1" defaultValue={it.sku||SKU_FROM(it.category,it.name)} onChange={e=>change(it.id,{sku:e.target.value})}/></td>
                    <td className="p-2 border"><input className="w-40 border rounded p-1" defaultValue={it.supplier||''} onChange={e=>change(it.id,{supplier:e.target.value})}/></td>
                    <td className="p-2 border"><input className="w-20 border rounded p-1" inputMode="numeric" defaultValue={String(it.orderMultiple??'') } onChange={e=>change(it.id,{orderMultiple:Number(e.target.value.replace(/[^0-9]/g,''))||undefined})}/></td>
                    <td className="p-2 border">
                      <div className="flex items-center gap-2">
                        <input className="w-24 border rounded p-1" placeholder="each/case/bag" defaultValue={cur.uom?.base||''} onChange={e=>change(it.id,{uom:{ base:e.target.value, toBase:cur.uom?.toBase||{} }})}/>
                        <button className="px-2 py-1 rounded border" onClick={()=>addUnit(it.id)}>+ unit</button>
                      </div>
                    </td>
                    <td className="p-2 border">
                      {Object.keys(cur.uom?.toBase||{}).length===0 ? <div className="text-xs text-gray-500">No smaller units.</div> : (
                        <div className="space-y-1">
                          {Object.entries(cur.uom!.toBase!).map(([uname, per])=>(
                            <div key={uname} className="flex items-center gap-2 text-xs">
                              <span className="w-20">{uname}</span><span>=</span>
                              <input className="w-20 border rounded p-1" inputMode="decimal" defaultValue={String(per)} onChange={e=>{
                                const n = Number(e.target.value.replace(/[^0-9.]/g,''))||0;
                                change(it.id,{uom:{ base:cur.uom!.base, toBase:{...cur.uom!.toBase,[uname]:n} }});
                              }}/>
                              <span>per 1 {cur.uom?.base||'base'}</span>
                              <button className="px-2 py-0.5 rounded border" onClick={()=>removeUnit(it.id, uname)}>remove</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-2 border">
                      <select className="border rounded p-1" defaultValue={it.makeOrBuy||'buy'} onChange={e=>change(it.id,{ makeOrBuy: (e.target.value as MakeBuy) })}>
                        <option value="buy">buy</option>
                        <option value="make">make</option>
                      </select>
                    </td>
                    <td className="p-2 border"><CopyCell itemId={it.id} onCopy={(src,mode)=>copyFrom(src,it.id,mode)} /></td>
                  </tr>
                );
              })}
              {view.length===0 && <tr><td className="p-3 text-sm text-gray-500" colSpan={9}>No items.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function CopyCell({ itemId, onCopy }:{ itemId:string; onCopy:(srcId:string,mode:'uom'|'all')=>void }) {
  const [src, setSrc] = useState(''); const items = allItems().filter(i=>i.id!==itemId);
  return (
    <div className="flex items-center gap-1">
      <select className="border rounded p-1 w-40 text-xs" value={src} onChange={e=>setSrc(e.target.value)}>
        <option value="">-- choose item --</option>
        {items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <button className="px-2 py-1 rounded border text-xs" disabled={!src} onClick={()=>onCopy(src,'uom')}>Copy UOM</button>
      <button className="px-2 py-1 rounded border text-xs" disabled={!src} onClick={()=>onCopy(src,'all')}>Copy all</button>
    </div>
  );
}

function AddModal({ onClose, defaultLocation }: { onClose: () => void; defaultLocation?: string }) {
  const [name, setName] = useState(''); const [cat, setCat] = useState('');
  const cats = Array.from(new Set(allItems().map(i=>i.category||'').filter(Boolean))).sort();
  const [locs, setLocs] = useState<Record<string, boolean>>(()=>{ const x:Record<string,boolean>={}; LOCATIONS.forEach(l=>x[l.key]=l.key===defaultLocation); return x; });

  function create() {
    const sel = Object.keys(locs).filter(k=>locs[k]); if (!name.trim()) {alert('Enter a name'); return;}
    if (sel.length===0) {alert('Pick at least one location'); return;}
    const item: Item = { id:`custom-${SLUG(name)}-${Date.now().toString(36)}`, name:name.trim(), category:cat||undefined, sku: SKU_FROM(cat||'', name), makeOrBuy:'buy', locations:sel };
    const list = jsonGet<Item[]>(LS_ITEMS, []); list.push(item); jsonSet(LS_ITEMS, list);
    alert('Added. You can edit details in Manage Items.'); onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center p-6">
      <div className="bg-white w-[min(720px,95vw)] rounded-2xl shadow-xl p-4 space-y-3">
        <div className="flex items-center justify-between"><div className="text-lg font-semibold">Add Item</div><button className="px-3 py-1.5 rounded border" onClick={onClose}>Close</button></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><label className="block text-sm font-medium mb-1">Name</label><input className="w-full border rounded p-2" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g., 12oz Hot"/></div>
          <div><label className="block text-sm font-medium mb-1">Category</label>
            <select className="w-full border rounded p-2" value={cat} onChange={e=>setCat(e.target.value)}><option value="">—</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-1">Locations</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {LOCATIONS.map(l=>(
              <label key={l.key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!locs[l.key]} onChange={e=>setLocs(p=>({...p,[l.key]:e.target.checked}))}/>
                <span>{l.group}: {l.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded bg-green-600 text-white" onClick={create}>Create</button>
          <button className="px-4 py-2 rounded border" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* CSV + Import/BOM overlay */
function parseCSV(text: string): string[][] {
  const rows:string[][]=[]; let row:string[]=[]; let val=''; let inQ=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (inQ) { if (c===`"`) { const n=text[i+1]; if (n===`"`) { val+='"'; i++; } else { inQ=false; } } else val+=c; }
    else { if (c===`"`) inQ=true; else if (c===',') { row.push(val); val=''; } else if (c===`\n`) { row.push(val); rows.push(row); row=[]; val=''; } else if (c===`\r`) {} else val+=c; }
  }
  row.push(val); rows.push(row); while(rows.length && rows[rows.length-1].every(c=>(c||'').trim()==='')) rows.pop(); return rows;
}
const safeNum = (s:string) => { const n = Number((s||'').replace(/[^0-9.\-]/g,'')); return Number.isFinite(n)?n:0; };

function ImportModal({ onClose }: { onClose: () => void; currentLocationKey: string }) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [idxName, setIdxName] = useState(-1);
  const [idxSku, setIdxSku] = useState(-1);
  const [idxQty, setIdxQty] = useState(-1);
  const [totals, setTotals] = useState<Record<string,{key:string;name:string;sku?:string;qty:number}>>({});
  const [boms, setBoms] = useState<Record<string,Bom>>(()=>jsonGet<Record<string,Bom>>(LS_BOMS,{}));

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = String(e.target?.result||''); const r = parseCSV(text); if (!r.length) { alert('CSV looks empty'); return; }
      const head = r[0]; const body = r.slice(1).filter(rr=>rr.some(c=>(c||'').trim()!=='')); setHeaders(head); setRows(body);
      const lower=head.map(h=>h.toLowerCase()); const find=(names:string[])=>lower.findIndex(h=>names.some(n=>h.includes(n)));
      setIdxName(find(['item','name','menu'])); setIdxSku(find(['sku','plu','id','code'])); setIdxQty(find(['qty','quantity','sold','units']));
    };
    reader.readAsText(file);
  }
  useEffect(()=> {
    if (idxName<0 || idxQty<0) return; const t:Record<string,{key:string;name:string;sku?:string;qty:number}>={};
    rows.forEach(r=>{ const n=r[idxName]||''; const s=idxSku>=0?(r[idxSku]||''):''; const q=safeNum(r[idxQty]||'0'); if (!n && !s) return; const key = (s?s.trim():n.trim().toLowerCase()); if (!t[key]) t[key]={key,name:n,sku:s||undefined,qty:0}; t[key].qty+=q; });
    setTotals(t);
  },[rows,idxName,idxSku,idxQty]);

  function saveBom(b: Bom) { const all = { ...boms, [b.key]: { ...b, updatedAt: new Date().toISOString() } }; setBoms(all); jsonSet(LS_BOMS, all); }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center p-6">
      <div className="bg-white w-[min(1100px,96vw)] rounded-2xl shadow-xl p-4 space-y-4 max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Import Toast CSV • Build BOMs • Prefill</div>
          <button className="px-3 py-1.5 rounded border" onClick={onClose}>Close</button>
        </div>

        <div className="flex items-center gap-3">
          <input type="file" accept=".csv,text/csv" onChange={e=>{const f=e.target.files?.[0]; if (f) handleFile(f);}} />
          <div className="text-sm text-gray-600">Map columns</div>
        </div>

        {headers.length>0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><div className="text-xs text-gray-600 mb-1">Item name column</div>
              <select className="w-full border rounded p-2" value={idxName} onChange={e=>setIdxName(Number(e.target.value))}><option value={-1}>-- choose --</option>{headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></div>
            <div><div className="text-xs text-gray-600 mb-1">SKU column (optional)</div>
              <select className="w-full border rounded p-2" value={idxSku} onChange={e=>setIdxSku(Number(e.target.value))}><option value={-1}>-- none --</option>{headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></div>
            <div><div className="text-xs text-gray-600 mb-1">Qty sold column</div>
              <select className="w-full border rounded p-2" value={idxQty} onChange={e=>setIdxQty(Number(e.target.value))}><option value={-1}>-- choose --</option>{headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></div>
          </div>
        )}

        {Object.keys(totals).length>0 && (
          <div className="space-y-3">
            <div className="text-sm text-gray-700">Distinct sold items: {Object.keys(totals).length} • Total units: {Object.values(totals).reduce((a,b)=>a+b.qty,0)}</div>
            <div className="space-y-3">
              <div className="font-medium">BOMs needed ({Object.values(totals).filter(t=>!jsonGet<Record<string,Bom>>(LS_BOMS,{})[t.key]).length} missing)</div>
              {Object.values(totals).filter(t=>!jsonGet<Record<string,Bom>>(LS_BOMS,{})[t.key]).slice(0,8).map(row => (
                <BomEditor key={row.key} row={row} onSave={saveBom} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
function BomEditor({ row, onSave }:{ row:{key:string;name:string;sku?:string;qty:number}; onSave:(b:Bom)=>void }) {
  const locItems = allItems();
  const want:Record<string,string[]> = { cup:['Cups'], lid:['Lids'], milk:['Milk'], espresso:['Beverage Base','Coffee Bulk','Tea'], syrup:['House Syrups','Syrups'], bag:['Packaging'] };
  function itemsForSlot(slot:keyof typeof want) { const target=want[slot]; const filtered = locItems.filter(i=>i.category && target.includes(i.category)); return filtered.length?filtered:locItems; }
  const [type, setType] = useState<'drink'|'pastry'|'other'>('drink');
  const [cup,setCup]=useState(''); const [cupQty,setCupQty]=useState('1'); const [cupU,setCupU]=useState('each');
  const [lid,setLid]=useState(''); const [lidQty,setLidQty]=useState('1'); const [lidU,setLidU]=useState('each');
  const [milk,setMilk]=useState(''); const [milkQty,setMilkQty]=useState('0'); const [milkU,setMilkU]=useState('each');
  const [esp,setEsp]=useState('');   const [espQty,setEspQty]=useState('0'); const [espU,setEspU]=useState('gram');
  const [syr,setSyr]=useState('');   const [syrQty,setSyrQty]=useState('0'); const [syrU,setSyrU]=useState('each');
  const [bag,setBag]=useState('');   const [bagQty,setBagQty]=useState('1'); const [bagU,setBagU]=useState('each');

  function save() {
    const b: Bom = {
      key: row.key, name: row.name||row.key, sku: row.sku, type,
      comps: {
        cup:(type!=='pastry'&&cup)?{itemId:cup,qty:Number(cupQty||'0'),uom:cupU}:undefined,
        lid:(type!=='pastry'&&lid)?{itemId:lid,qty:Number(lidQty||'0'),uom:lidU}:undefined,
        milk:(type!=='pastry'&&milk)?{itemId:milk,qty:Number(milkQty||'0'),uom:milkU}:undefined,
        espresso:(type!=='pastry'&&esp)?{itemId:esp,qty:Number(espQty||'0'),uom:espU}:undefined,
        syrup:(type!=='pastry'&&syr)?{itemId:syr,qty:Number(syrQty||'0'),uom:syrU}:undefined,
        bag:(type==='pastry'&&bag)?{itemId:bag,qty:Number(bagQty||'0'),uom:bagU}:undefined,
      },
      updatedAt:new Date().toISOString(),
    };
    onSave(b); alert(`BOM saved for ${row.sku?row.sku:row.name}`);
  }

  return (
    <div className="border rounded-xl p-3 space-y-2">
      <div className="text-sm"><span className="font-medium">Item:</span> {(row.sku?row.sku+' — ':'')+row.name} <span className="text-gray-500">(sold: {row.qty})</span></div>
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-1"><input type="radio" name={`t_${row.key}`} checked={type==='drink'} onChange={()=>setType('drink')}/> Drink</label>
        <label className="flex items-center gap-1"><input type="radio" name={`t_${row.key}`} checked={type==='pastry'} onChange={()=>setType('pastry')}/> Pastry</label>
        <label className="flex items-center gap-1"><input type="radio" name={`t_${row.key}`} checked={type==='other'} onChange={()=>setType('other')}/> Other</label>
      </div>
      {type!=='pastry' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Chooser label="Cup" items={itemsForSlot('cup')} value={cup} setValue={setCup} qty={cupQty} setQty={setCupQty} uom={cupU} setUom={setCupU}/>
          <Chooser label="Lid" items={itemsForSlot('lid')} value={lid} setValue={setLid} qty={lidQty} setQty={setLidQty} uom={lidU} setUom={setLidU}/>
          <Chooser label="Milk" items={itemsForSlot('milk')} value={milk} setValue={setMilk} qty={milkQty} setQty={setMilkQty} uom={milkU} setUom={setMilkU}/>
          <Chooser label="Espresso/Coffee" items={itemsForSlot('espresso')} value={esp} setValue={setEsp} qty={espQty} setQty={setEspQty} uom={espU} setUom={setEspU}/>
          <Chooser label="Syrup" items={itemsForSlot('syrup')} value={syr} setValue={setSyr} qty={syrQty} setQty={setSyrQty} uom={syrU} setUom={setSyrU}/>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <Chooser label="Bag" items={itemsForSlot('bag')} value={bag} setValue={setBag} qty={bagQty} setQty={setBagQty} uom={bagU} setUom={setBagU}/>
        </div>
      )}
      <div><button className="px-4 py-2 rounded bg-green-600 text-white" onClick={save}>Save BOM</button></div>
    </div>
  );
}
function Chooser({ label, items, value, setValue, qty, setQty, uom, setUom }:{
  label:string; items:Item[]; value:string; setValue:(s:string)=>void; qty:string; setQty:(s:string)=>void; uom:string; setUom:(s:string)=>void;
}) {
  useEffect(()=>{ if (!value) return; const it=itemsById()[value]; const opts=unitsForItem(it); if (!opts.includes(uom)) setUom(opts[0]); /* eslint-disable-next-line */ },[value]);
  return (
    <div>
      <div className="text-gray-600 mb-1">{label}</div>
      <select className="w-full border rounded p-2" value={value} onChange={e=>setValue(e.target.value)}>
        <option value="">-- choose item --</option>
        {items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
      <div className="mt-1 flex items-center gap-2">
        <input className="w-20 border rounded p-1" inputMode="decimal" value={qty} onChange={e=>setQty(e.target.value.replace(/[^0-9.]/g,''))}/>
        <select className="border rounded p-1" value={uom} onChange={e=>setUom(e.target.value)}>
          {value ? unitsForItem(itemsById()[value]).map(o=><option key={o} value={o}>{o}</option>) : <option value="each">each</option>}
        </select>
      </div>
    </div>
  );
}

/* PAR Sheet */
function ParsModal({ onClose }: { onClose: () => void }) {
  const items = allItems();
  const ov = jsonGet<Record<string, Partial<Item>>>(LS_OVERRIDES, {});
  const [draft, setDraft] = useState<Record<string, Record<string, { qty: string; unit: string }>>>(() => {
    const d: Record<string, Record<string, { qty: string; unit: string }>> = {};
    items.forEach(it => {
      d[it.id] = {};
      LOCATIONS.forEach(l => {
        const baseQty = ov[it.id]?.par?.[l.key] ?? '';
        const prefUnit = ov[it.id]?.parUnit?.[l.key] || (unitsForItem(it)[0] || 'each');
        const disp = baseQty === '' ? '' : String(roundForDisplay(fromBaseQty(it, Number(baseQty), prefUnit)));
        d[it.id][l.key] = { qty: String(disp), unit: prefUnit };
      });
    });
    return d;
  });

  function setCell(itemId: string, locKey: string, next: Partial<{ qty: string; unit: string }>) {
    setDraft(p => ({ ...p, [itemId]: { ...(p[itemId]||{}), [locKey]: { ...(p[itemId]?.[locKey] || { qty:'', unit:'each' }), ...next } } }));
  }

  function save() {
    const overrides = jsonGet<Record<string, Partial<Item>>>(LS_OVERRIDES, {});
    items.forEach(it => {
      const row = draft[it.id]; if (!row) return;
      const parRec: Record<string, number> = {};
      const unitRec: Record<string, string> = {};
      Object.keys(row).forEach(loc => {
        const q = Number(row[loc].qty || ''); const u = row[loc].unit || (unitsForItem(it)[0]||'each');
        if (Number.isFinite(q) && q > 0) { parRec[loc] = toBaseQty(it, q, u); unitRec[loc] = u; }
      });
      overrides[it.id] = { ...(overrides[it.id]||{}), par: parRec, parUnit: unitRec };
    });
    jsonSet(LS_OVERRIDES, overrides);
    alert('PARs saved.'); onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center p-6">
      <div className="bg-white w-[min(1200px,95vw)] rounded-2xl shadow-xl p-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold">PAR Sheet (per location, choose UOM)</div>
          <div className="flex gap-2"><button className="px-3 py-1.5 rounded border" onClick={onClose}>Back</button><button className="px-3 py-1.5 rounded bg-indigo-600 text-white" onClick={save}>Save PARs</button></div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="p-2 border">Item</th>
                {LOCATIONS.map(l => <th key={l.key} className="p-2 border">{l.group}: {l.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const opts = unitsForItem(it);
                return (
                  <tr key={it.id}>
                    <td className="p-2 border">{it.name}</td>
                    {LOCATIONS.map(l => (
                      <td key={l.key} className="p-2 border">
                        <div className="flex items-center gap-2">
                          <input className="w-20 border rounded p-1" inputMode="decimal" value={draft[it.id]?.[l.key]?.qty || ''} onChange={e=>setCell(it.id, l.key, { qty: e.target.value.replace(/[^0-9.]/g,'') })}/>
                          <select className="border rounded p-1" value={draft[it.id]?.[l.key]?.unit || opts[0]} onChange={e=>setCell(it.id,l.key,{ unit: e.target.value })}>
                            {opts.map(o=><option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-gray-500 mt-2">We store PARs in base units but you can pick any UOM per location for data entry and display.</div>
      </div>
    </div>
  );
}

function PicklistModal({ onClose, getPar, onHandBase }:{
  onClose:()=>void; getPar:(itemId:string,locKey:string)=>number; onHandBase:(itemId:string,locKey:string)=>number;
}) {
  const items = allItems();
  const [sources,setSources]=useState<Record<string,boolean>>(()=>{const x:Record<string,boolean>={}; LOCATIONS.filter(l=>WAREHOUSE_KEYS.has(l.key)).forEach(l=>x[l.key]=true); return x;});
  const [dests,setDests]=useState<Record<string,boolean>>(()=>{const x:Record<string,boolean>={}; LOCATIONS.filter(l=>!WAREHOUSE_KEYS.has(l.key)).forEach(l=>x[l.key]=true); return x;});

  function needAt(itemId:string, loc:string) { return Math.max((getPar(itemId, loc)||0) - (onHandBase(itemId, loc)||0), 0); }

  const rows: Array<{ dest:string; item:string; qty:number }> = [];
  LOCATIONS.filter(l=>dests[l.key]).forEach(loc=>{
    items.forEach(it=>{ const need=needAt(it.id, loc.key); if (need>0) rows.push({ dest:`${loc.group}: ${loc.name}`, item:it.name, qty:need }); });
  });

  const pullByItem:Record<string,number>={}; rows.forEach(r=>{ pullByItem[r.item]=(pullByItem[r.item]||0)+r.qty; });

  const availableByItem:Record<string,number>={};
  LOCATIONS.filter(l=>sources[l.key]).forEach(src=>{
    items.forEach(it=>{ availableByItem[it.name]=(availableByItem[it.name]||0)+(onHandBase(it.id, src.key)||0); });
  });

  function downloadCSV() {
    const lines:string[]=[]; lines.push(['Destination','Item','Qty (base)'].join(','));
    rows.forEach(r=>lines.push([r.dest,r.item,String(r.qty)].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')));
    const blob=new Blob([lines.join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='picklist.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center p-6">
      <div className="bg-white w-[min(1100px,96vw)] rounded-2xl shadow-xl p-4 space-y-4 max-h-[92vh] overflow-auto">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Picklist (base units)</div>
          <div className="flex gap-2"><button className="px-3 py-1.5 rounded border" onClick={onClose}>Close</button><button className="px-3 py-1.5 rounded bg-indigo-600 text-white" onClick={downloadCSV}>Download CSV</button></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded p-3">
            <div className="font-medium mb-2">Source warehouses</div>
            {LOCATIONS.filter(l=>WAREHOUSE_KEYS.has(l.key)).map(l=>(
              <label key={l.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!sources[l.key]} onChange={e=>setSources(p=>({...p,[l.key]:e.target.checked}))}/><span>{l.group}: {l.name}</span></label>
            ))}
          </div>
          <div className="border rounded p-3">
            <div className="font-medium mb-2">Destinations</div>
            {LOCATIONS.filter(l=>!WAREHOUSE_KEYS.has(l.key)).map(l=>(
              <label key={l.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!dests[l.key]} onChange={e=>setDests(p=>({...p,[l.key]:e.target.checked}))}/><span>{l.group}: {l.name}</span></label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded p-3 overflow-auto">
            <div className="font-medium mb-2">Per-destination pulls</div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-2 border">Destination</th><th className="p-2 border">Item</th><th className="p-2 border">Need</th></tr></thead>
              <tbody>{rows.map((r,i)=><tr key={i}><td className="p-2 border">{r.dest}</td><td className="p-2 border">{r.item}</td><td className="p-2 border text-right">{r.qty}</td></tr>)}
                {rows.length===0 && <tr><td className="p-3 text-gray-500 border" colSpan={3}>Nothing needed.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="border rounded p-3 overflow-auto">
            <div className="font-medium mb-2">Consolidated pull vs available</div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50"><tr><th className="p-2 border">Item</th><th className="p-2 border">Pull total</th><th className="p-2 border">Available @ source(s)</th></tr></thead>
              <tbody>
                {Object.keys(pullByItem).map(k=><tr key={k}><td className="p-2 border">{k}</td><td className="p-2 border text-right">{pullByItem[k]}</td><td className="p-2 border text-right">{availableByItem[k]||0}</td></tr>)}
                {Object.keys(pullByItem).length===0 && <tr><td className="p-3 text-gray-500 border" colSpan={3}>—</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderModal({ onClose, getPar, onHandBase }:{
  onClose:()=>void; getPar:(itemId:string,locKey:string)=>number; onHandBase:(itemId:string,locKey:string)=>number;
}) {
  const items = allItems();
  const dests = LOCATIONS.filter(l=>!WAREHOUSE_KEYS.has(l.key));
  const sources = LOCATIONS.filter(l=>WAREHOUSE_KEYS.has(l.key));

  // total need vs available (for BUY items)
  const needByItem:Record<string,number>={};
  dests.forEach(loc=>{ items.forEach(it=>{ const need=Math.max((getPar(it.id, loc.key)||0)-(onHandBase(it.id,loc.key)||0),0); if ((it.makeOrBuy||'buy')==='buy') needByItem[it.name]=(needByItem[it.name]||0)+need; }); });
  const availByItem:Record<string,number>={};
  sources.forEach(loc=>{ items.forEach(it=>{ if ((it.makeOrBuy||'buy')==='buy') availByItem[it.name]=(availByItem[it.name]||0)+(onHandBase(it.id,loc.key)||0); }); });
  const orderRows = Object.keys(needByItem).map(k=>({ item:k, need:needByItem[k], available:availByItem[k]||0, order:Math.max(needByItem[k]-(availByItem[k]||0),0) })).filter(r=>r.order>0);

  // Production (MAKE items): deficits after using ALL on-hand across ALL locations
  const makeNeed:Record<string,number>={};
  dests.forEach(loc=>{ items.forEach(it=>{ if ((it.makeOrBuy||'buy')==='make') { const need=Math.max((getPar(it.id, loc.key)||0)-(onHandBase(it.id,loc.key)||0),0); makeNeed[it.name]=(makeNeed[it.name]||0)+need; } }); });
  const makeAvail:Record<string,number>={};
  LOCATIONS.forEach(loc=>{ items.forEach(it=>{ if ((it.makeOrBuy||'buy')==='make') makeAvail[it.name]=(makeAvail[it.name]||0)+(onHandBase(it.id,loc.key)||0); }); });
  const productionRows = Object.keys(makeNeed).map(k=>({ item:k, need:makeNeed[k], onHandGlobal:makeAvail[k]||0, produce:Math.max(makeNeed[k]-(makeAvail[k]||0),0) })).filter(r=>r.produce>0);

  function downloadOrderCSV() {
    const lines:string[]=[]; lines.push(['Item','Need total (base)','Available at warehouses','Order Qty (base)'].join(','));
    orderRows.forEach(r=>lines.push([r.item,r.need,r.available,r.order].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')));
    const blob=new Blob([lines.join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='order_list.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }
  function downloadProductionCSV() {
    const lines:string[]=[]; lines.push(['Item','Need total (base)','Global On-hand','Produce Qty (base)'].join(','));
    productionRows.forEach(r=>lines.push([r.item,r.need,r.onHandGlobal,r.produce].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')));
    const blob=new Blob([lines.join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='production_list.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-start justify-center p-6">
      <div className="bg-white w-[min(900px,95vw)] rounded-2xl shadow-xl p-4 max-h-[90vh] overflow-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Order List (buy items, base units)</div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 rounded border" onClick={onClose}>Back</button>
            <button className="px-3 py-1.5 rounded bg-indigo-600 text-white" onClick={downloadOrderCSV}>Download CSV</button>
          </div>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0"><tr><th className="p-2 border">Item</th><th className="p-2 border">Need total</th><th className="p-2 border">Available</th><th className="p-2 border">Order</th></tr></thead>
          <tbody>{orderRows.map((r,i)=><tr key={i}><td className="p-2 border">{r.item}</td><td className="p-2 border text-right">{r.need}</td><td className="p-2 border text-right">{r.available}</td><td className="p-2 border text-right">{r.order}</td></tr>)}
            {orderRows.length===0 && <tr><td className="p-3 text-gray-500 border" colSpan={4}>No shortages — warehouses can cover current PAR needs.</td></tr>}
          </tbody>
        </table>

        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Production (make items)</div>
          <button className="px-3 py-1.5 rounded bg-emerald-600 text-white" onClick={downloadProductionCSV}>Download Production CSV</button>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 sticky top-0"><tr><th className="p-2 border">Item</th><th className="p-2 border">Need total</th><th className="p-2 border">Global On-hand</th><th className="p-2 border">Produce</th></tr></thead>
          <tbody>{productionRows.map((r,i)=><tr key={i}><td className="p-2 border">{r.item}</td><td className="p-2 border text-right">{r.need}</td><td className="p-2 border text-right">{r.onHandGlobal}</td><td className="p-2 border text-right">{r.produce}</td></tr>)}
            {productionRows.length===0 && <tr><td className="p-3 text-gray-500 border" colSpan={4}>No make items need production right now.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

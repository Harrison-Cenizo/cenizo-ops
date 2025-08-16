export type LocationGroup = 'Cenizo' | 'Sano Market' | 'Other';

export type Location = {
  group: LocationGroup;
  name: string;
  key: string; // group:name
};

function mkLoc(group: LocationGroup, name: string): Location {
  return { group, name, key: group + ':' + name };
}

export const LOCATIONS: Location[] = [
  mkLoc('Cenizo', 'Easton Park'),
  mkLoc('Cenizo', 'Del Valle'),
  mkLoc('Sano Market', 'Easton Park'),
  mkLoc('Other', 'Chrysler Bend'),
  mkLoc('Other', 'Old Lockhart'),
];

// You can edit this list any time.
// par and orderMultiple are optional (handy for Phase 2 “auto order”).
export type Item = {
  id: string;
  name: string;
  unit?: string; // e.g., "bag", "case(12)", "sleeve(50)"
  locations: string[]; // list of location keys this item belongs to
  par?: Record<string, number>; // per-location par by key
  orderMultiple?: number; // e.g., cases of 12
  supplier?: string;
  sku?: string;
};

export const ITEMS: Item[] = [
  {
    id: 'oat-milk',
    name: 'Oat Milk 32oz',
    unit: 'case(12)',
    locations: ['Cenizo:Easton Park', 'Cenizo:Del Valle', 'Sano Market:Easton Park'],
    par: { 'Cenizo:Easton Park': 10, 'Cenizo:Del Valle': 6, 'Sano Market:Easton Park': 4 },
    orderMultiple: 1,
    supplier: 'Distributor A',
  },
  {
    id: 'cold-cups-16',
    name: 'Cold Cups 16oz',
    unit: 'sleeve(50)',
    locations: ['Cenizo:Easton Park', 'Cenizo:Del Valle', 'Other:Old Lockhart'],
    par: { 'Cenizo:Easton Park': 12, 'Cenizo:Del Valle': 8, 'Other:Old Lockhart': 4 },
    orderMultiple: 1,
    supplier: 'Packaging Co',
  },
  {
    id: 'lids-16',
    name: 'Cold Lids 16oz',
    unit: 'sleeve(50)',
    locations: ['Cenizo:Easton Park', 'Cenizo:Del Valle'],
    par: { 'Cenizo:Easton Park': 12, 'Cenizo:Del Valle': 8 },
  },
  {
    id: 'whole-bean-house-5lb',
    name: 'Whole Bean — House (5lb)',
    unit: 'bag',
    locations: ['Cenizo:Easton Park', 'Cenizo:Del Valle', 'Other:Old Lockhart'],
    par: { 'Cenizo:Easton Park': 6, 'Cenizo:Del Valle': 4, 'Other:Old Lockhart': 2 },
    supplier: 'Roaster',
  },
  {
    id: 'sleeves',
    name: 'Hot Cup Sleeves',
    unit: 'sleeve(50)',
    locations: ['Cenizo:Easton Park', 'Cenizo:Del Valle', 'Sano Market:Easton Park'],
    par: { 'Cenizo:Easton Park': 10, 'Cenizo:Del Valle': 6, 'Sano Market:Easton Park': 4 },
  },
  {
    id: 'napkins',
    name: 'Napkins',
    unit: 'pack',
    locations: ['Cenizo:Easton Park', 'Cenizo:Del Valle', 'Sano Market:Easton Park', 'Other:Chrysler Bend', 'Other:Old Lockhart'],
    par: { 'Cenizo:Easton Park': 8, 'Cenizo:Del Valle': 6, 'Sano Market:Easton Park': 4, 'Other:Chrysler Bend': 2, 'Other:Old Lockhart': 2 },
  }
];

// Curated Unsplash stock photos per industry — free to use, stable CDN URLs
// Source: unsplash.com (license: free for commercial use)
// Each industry has 3 hero variants (one per template A/B/C) and 3 office variants + 6 gallery.

export interface IndustryImages {
  heroes: [string, string, string];      // 3 hero variants (A, B, C)
  offices: [string, string, string];     // 3 office variants (A, B, C)
  gallery: string[];                     // 6+ gallery images
}

export const STOCK_IMAGES: Record<string, IndustryImages> = {
  Legal: {
    heroes: [
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1600&q=80',   // law books
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1600&q=80',   // meeting handshake
      'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=1600&q=80',   // columns courthouse
    ],
    offices: [
      'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1200&q=80',
      'https://images.unsplash.com/photo-1423592707957-3b212afa6733?w=1200&q=80',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1589216532372-1c2a367900d9?w=800&q=80',
      'https://images.unsplash.com/photo-1494172961521-33799ddd43a5?w=800&q=80',
      'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80',
      'https://images.unsplash.com/photo-1423592707957-3b212afa6733?w=800&q=80',
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',
      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
    ],
  },
  Dental: {
    heroes: [
      'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1600&q=80',   // modern clinic
      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=1600&q=80',   // dental chair
      'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=1600&q=80',   // smile white
    ],
    offices: [
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80',
      'https://images.unsplash.com/photo-1598531228433-d9f0cb960816?w=1200&q=80',
      'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80',
      'https://images.unsplash.com/photo-1598531228433-d9f0cb960816?w=800&q=80',
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=800&q=80',
      'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800&q=80',
      'https://images.unsplash.com/photo-1606811951341-7c52bd29a4a4?w=800&q=80',
      'https://images.unsplash.com/photo-1583912268183-a34d41fe1618?w=800&q=80',
    ],
  },
  Roofing: {
    heroes: [
      'https://images.unsplash.com/photo-1632759145351-1d5a3e6c4e33?w=1600&q=80',
      'https://images.unsplash.com/photo-1605462863863-10d9e47e15ee?w=1600&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=80',
      'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1605462863863-10d9e47e15ee?w=800&q=80',
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80',
      'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=800&q=80',
    ],
  },
  Plumbing: {
    heroes: [
      'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=1600&q=80',
      'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=1600&q=80',
      'https://images.unsplash.com/photo-1621905252472-e8de8a6a8ec9?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=80',
      'https://images.unsplash.com/photo-1542013936693-884638332954?w=1200&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?w=800&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=800&q=80',
      'https://images.unsplash.com/photo-1621905252472-e8de8a6a8ec9?w=800&q=80',
      'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&q=80',
      'https://images.unsplash.com/photo-1542013936693-884638332954?w=800&q=80',
    ],
  },
  HVAC: {
    heroes: [
      'https://images.unsplash.com/photo-1631545806609-03c2f6a0ca8e?w=1600&q=80',
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1600&q=80',
      'https://images.unsplash.com/photo-1597807513043-c2f3fd9e3f62?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
      'https://images.unsplash.com/photo-1631545806609-03c2f6a0ca8e?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1631545806609-03c2f6a0ca8e?w=800&q=80',
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80',
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80',
      'https://images.unsplash.com/photo-1597807513043-c2f3fd9e3f62?w=800&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      'https://images.unsplash.com/photo-1620558668717-0d21eb9fd1b9?w=800&q=80',
    ],
  },
  Auto: {
    heroes: [
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1600&q=80',
      'https://images.unsplash.com/photo-1632823471565-1ecdf5dd5bb7?w=1600&q=80',
      'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1632823469850-2f77dd9c7f93?w=1200&q=80',
      'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=1200&q=80',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1632823471565-1ecdf5dd5bb7?w=800&q=80',
      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800&q=80',
      'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=800&q=80',
      'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=800&q=80',
      'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80',
      'https://images.unsplash.com/photo-1632823469850-2f77dd9c7f93?w=800&q=80',
    ],
  },
  Medical: {
    heroes: [
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1600&q=80',
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1600&q=80',
      'https://images.unsplash.com/photo-1551190822-a9333d879b1f?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1581056771107-24ca5f033842?w=1200&q=80',
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=1200&q=80',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80',
      'https://images.unsplash.com/photo-1581056771107-24ca5f033842?w=800&q=80',
      'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
      'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=80',
      'https://images.unsplash.com/photo-1551190822-a9333d879b1f?w=800&q=80',
    ],
  },
  'Real Estate': {
    heroes: [
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1600&q=80',
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1600&q=80',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=1200&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80',
      'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80',
      'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&q=80',
      'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    ],
  },
  Construction: {
    heroes: [
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1600&q=80',
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1600&q=80',
      'https://images.unsplash.com/photo-1590274853856-f22d5ee3d228?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&q=80',
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1200&q=80',
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=800&q=80',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=80',
      'https://images.unsplash.com/photo-1590274853856-f22d5ee3d228?w=800&q=80',
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80',
      'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&q=80',
      'https://images.unsplash.com/photo-1556075798-4825dfaaf498?w=800&q=80',
    ],
  },
  Electrical: {
    heroes: [
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=1600&q=80',
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=1600&q=80',
      'https://images.unsplash.com/photo-1620558668717-0d21eb9fd1b9?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1200&q=80',
      'https://images.unsplash.com/photo-1597765429128-4c9b2e6c2c23?w=1200&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&q=80',
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800&q=80',
      'https://images.unsplash.com/photo-1620558668717-0d21eb9fd1b9?w=800&q=80',
      'https://images.unsplash.com/photo-1597765429128-4c9b2e6c2c23?w=800&q=80',
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80',
    ],
  },
  Chiropractic: {
    heroes: [
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1600&q=80',
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1600&q=80',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1600&q=80',
    ],
    offices: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=1200&q=80',
      'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=1200&q=80',
    ],
    gallery: [
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
      'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80',
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&q=80',
      'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=800&q=80',
      'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=80',
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80',
    ],
  },
};

export const DEFAULT_IMAGES: IndustryImages = {
  heroes: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1600&q=80',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80',
  ],
  offices: [
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1200&q=80',
  ],
  gallery: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80',
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800&q=80',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&q=80',
    'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=800&q=80',
    'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800&q=80',
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80',
  ],
};

export function getStockImages(industry: string): IndustryImages {
  return STOCK_IMAGES[industry] || DEFAULT_IMAGES;
}

// Returns images for a specific template letter (a/b/c) — rotates so each template gets different ones
export function getStockImagesForTemplate(industry: string, letter: string): { hero: string; office: string; gallery: string[] } {
  const stock = getStockImages(industry);
  const idx = letter === 'a' ? 0 : letter === 'b' ? 1 : letter === 'c' ? 2 : (letter.charCodeAt(0) - 97) % 3;
  // rotate gallery so each template gets a different starting image + different order
  const rotated = [...stock.gallery.slice(idx * 2), ...stock.gallery.slice(0, idx * 2)];
  return {
    hero: stock.heroes[idx] || stock.heroes[0],
    office: stock.offices[idx] || stock.offices[0],
    gallery: rotated,
  };
}

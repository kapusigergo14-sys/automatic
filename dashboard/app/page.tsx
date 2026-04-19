import { loadAllLeads, getPoolCounts } from '@/lib/data';
import LeadsExplorer from './LeadsExplorer';

// Disable static rendering — always re-read JSON files on each request.
export const dynamic = 'force-dynamic';

export default function HomePage() {
  const leads = loadAllLeads();
  const counts = getPoolCounts();
  return <LeadsExplorer initialLeads={leads} counts={counts} />;
}

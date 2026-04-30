export type InsightItem = {
  id: string
  badge: string
  badgeColor: string
  title: string
  kpi: string
  body: string
  expandItems?: Array<{ pid?: string; couple?: string; venue?: string; value?: string; commits?: string[] }>
}

export const INSIGHTS: InsightItem[] = [
  {
    id: 'team4-gap',
    badge: 'STRUCTURAL ALLOCATION GAP',
    badgeColor: '#EF4444',
    title: 'Team Anant Coverage Gap',
    kpi: '4 PIDs · ₹1.17Cr',
    body: 'All four Team Anant PIDs (19935, 28172, 29662, 30969) carry zero designer or PM allocation. Highest-value case 28172 (Navya and Ashmann, ₹43.5L, The Leela Kovalam) had bride\'s father question team structure on Feb 15. Closest event 29662 (Amrutha and Jay, Sep 2026) is 136 days out. Ananth Santhosh covers all 4 PIDs without designer or PM allocation.',
  },
  {
    id: 'payment-velocity',
    badge: 'PORTFOLIO COLLECTION HEALTH',
    badgeColor: '#F59E0B',
    title: 'Payment Velocity Pattern',
    kpi: '75% below 20%',
    body: '75% of portfolio (15 of 20 PIDs) sits below 20% collection. Five PIDs are at 0%. Only 24292 (42%) and 20614 (24%) show real momentum. Roughly ₹1.4Cr in expected revenue is in unstructured collection schedules. Five PIDs need formal installment plans drafted in May; without them, the August-September collection window will compress into a panic.',
  },
  {
    id: 'exec-cluster',
    badge: 'EXECUTION CLUSTER FORMING',
    badgeColor: '#EF4444',
    title: 'Critical Window',
    kpi: '13 weddings · 5 months',
    body: 'Portfolio enters a compressed execution window in Q3-Q4 2026: 2 events in September, 5 in November, 6 in December. 13 weddings across 5 months on this team alone. Bandwidth planning, vendor lock-in, and team workload distribution decisions need to start in June. Current team sizing (4 teams, with Team Anant missing designer + PM) is unlikely to absorb peak volume without escalation.',
  },
  {
    id: 'workload-dist',
    badge: 'PLANNER LOAD ASYMMETRY',
    badgeColor: '#F59E0B',
    title: 'Workload Distribution',
    kpi: '₹1.41Cr · 5 PIDs',
    body: 'Bhavika Gurnani\'s workload distribution warrants attention: 5 active PIDs totaling ₹1.41Cr BGMV, with 24292 in full execution mode this week (236 messages in last 7 days, highest team-wide). September pipeline includes 30646 (Sayaji Udaipur) entering pre-execution. Recommend reviewing whether one PID could be reassigned to balance load entering Q3.',
  },
  {
    id: 'vendor-conc',
    badge: 'VENUE POC CONCENTRATION',
    badgeColor: '#8B5CF6',
    title: 'Concentrated Vendor Dependency',
    kpi: '4 PIDs · ₹1.58Cr',
    body: 'Abhishek Hanswal (Meragi venue relationship manager) is the named POC across at least 4 Udaipur PIDs: 30646 (Sayaji), 32245 (Kanooja/Turban Bhawani), 32125 (ITC Mementos), 26903 (Sterling Aravalli). Venue decisions for ₹1.58Cr GMV are concentrated through one person. No delay signals detected currently. This becomes a structural risk as execution ramps in Q3 2026.',
    expandItems: [
      { pid: '30646', couple: 'Chinmay & Jhanvi', venue: 'Sayaji Resort, Udaipur', value: '₹35L' },
      { pid: '32245', couple: 'Pavan & Sheenam', venue: 'Kanooja Palace, Kumbhalgarh', value: '₹21L' },
      { pid: '32125', couple: 'Khushali & Sapan', venue: 'ITC Mementos, Udaipur', value: '₹67L' },
      { pid: '26903', couple: 'Radhika & Manan', venue: 'Sterling Aravalli, Udaipur', value: '₹24.5L' },
    ],
  },
  {
    id: 'open-commit',
    badge: 'TRUST EROSION INDICATOR',
    badgeColor: '#EF4444',
    title: 'Open Commitment Decay',
    kpi: '14 open · 9 PIDs',
    body: 'Across all active projects, 14 explicit commitments made by team members in the last 30 days remain unclosed in chat. "Will share by EOD," "let me check and revert," "sending shortly." Concentrated in 9 PIDs, with 24292 carrying 4 alone. Open commitments are the strongest leading indicator of client trust erosion in service businesses.',
    expandItems: [
      { pid: '24292', couple: 'Aayushi & Dhruv', commits: ['Bhavika: room list by EOD (Apr 27)', 'Pragya: itinerary board upload (Apr 27)', 'Bhavika to Dhruv: finance check (Apr 23)', 'Bhavika: will be done tonight re payment (Apr 22)'] },
      { pid: '20614', couple: 'Kashish & Aditya', commits: ['Bhavika: full MOM from intro call', 'Bhavi: rooming/venue images from Mohit handover'] },
      { pid: '26903', couple: 'Radhika & Manan', commits: ['Aditya: proactive May check-in', 'Share planning deliverables to show visible progress'] },
    ],
  },
]

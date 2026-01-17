import { supabaseAdmin } from '~/utils/supabase';

async function getRoutineMap() {
  const { data, error } = await supabaseAdmin.rpc('get_routine_heatmap_data');
  if (error) {
    console.error('Error executing query:', error);
    throw error;
  }
  return data;
}

// Types for heatmap data
interface HeatmapRow {
  date: string | Date;
  created_at?: string | Date;
  hour: number;
  executions: number;
  errors: number;
}

interface HeatmapDayData {
  x: string;
  y: number;
}

interface HeatmapSeries {
  name: string;
  data: HeatmapDayData[];
}

function transformToHeatMapSeries(rows: HeatmapRow[]): {
  series: HeatmapSeries[];
  monthNames: string[];
} {
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const byMonth: Record<string, Record<number, Record<number, number>>> = {};
  for (const m of monthNames) byMonth[m] = {};

  rows.forEach((row) => {
    const dateObj = new Date(row.date);
    const month = monthNames[dateObj.getMonth()];
    const day = dateObj.getDate();
    const hour = Number(row.hour);
    const executions = Number(row.executions);
    if (!byMonth[month][day]) byMonth[month][day] = {};
    byMonth[month][day][hour] = executions;
  });

  const series: HeatmapSeries[] = monthNames.map((month) => ({
    name: month,
    data: Array.from({ length: 31 }, (_, dayIdx) => {
      const day = dayIdx + 1;
      const hours = byMonth[month][day] || {};
      const y = Object.values(hours).reduce(
        (sum, v) => sum + (typeof v === 'number' ? v : 0),
        0
      );
      return { x: `${day}`, y };
    }),
  }));
  return { series, monthNames };
}

export default defineEventHandler(async (event) => {
  if (event.node.req.method === 'GET') {
    try {
      const rows = await getRoutineMap();
      const { series, monthNames } = transformToHeatMapSeries(rows);
      const year = new Date().getFullYear();
      return {
        chartSeries: series,
        monthNames,
        yearOptions: Array.from({ length: 10 }, (_, i) => year - i),
        editableRanges: [
          { from: 1, to: 25 },
          { from: 26, to: 50 },
          { from: 51, to: 75 },
          { from: 76, to: Infinity },
        ],
        rawData: rows,
      };
    } catch (error) {
      return { error: 'Failed to fetch heatmap data' };
    }
  } else {
    return { error: 'Invalid request' };
  }
});

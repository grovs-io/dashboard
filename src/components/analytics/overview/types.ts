/** One point of the new-users trend as the overview chart consumes it. */
export type TrendChartPoint = {
  date: string;
  users: number;
  previousUsers: number;
  /** USD, not cents. Absent when the backend reports no revenue for the point. */
  revenue?: number;
};

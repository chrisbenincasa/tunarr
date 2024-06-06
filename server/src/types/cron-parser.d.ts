declare module 'cron-parser/lib/expression' {
  namespace CronExpression {
    const map: ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];
    const constraints: [
      { min: 0; max: 59; chars: [] }, // Second
      { min: 0; max: 59; chars: [] }, // Minute
      { min: 0; max: 23; chars: [] }, // Hour
      { min: 1; max: 31; chars: ['L'] }, // Day of month
      { min: 1; max: 12; chars: [] }, // Month
      { min: 0; max: 7; chars: ['L'] }, // Day of week
    ];
  }

  export default CronExpression;
}

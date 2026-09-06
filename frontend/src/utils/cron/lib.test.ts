import { describe, expect, it } from 'vitest';
import { describeCron, nextRuns, parseCron } from './lib';

describe('cron', () => {
  it('parses wildcards to full ranges', () => {
    const s = parseCron('* * * * *');
    expect(s.minute.size).toBe(60);
    expect(s.hour.size).toBe(24);
    expect(s.dom.size).toBe(31);
    expect(s.month.size).toBe(12);
    expect(s.dow.size).toBe(7);
  });

  it('parses steps, ranges, lists and names', () => {
    const s = parseCron('*/15 9-17 * * MON-FRI');
    expect([...s.minute]).toEqual([0, 15, 30, 45]);
    expect(s.hour.has(9) && s.hour.has(17) && !s.hour.has(8)).toBe(true);
    expect(s.dow.has(1) && s.dow.has(5) && !s.dow.has(0) && !s.dow.has(6)).toBe(true);
  });

  it('parses month names', () => {
    const s = parseCron('0 0 1 JAN,JUN *');
    expect([...s.month]).toEqual([1, 6]);
  });

  it('rejects invalid expressions', () => {
    for (const bad of ['', 'a b', '* * * *', '* * * * * *', '60 * * * *', '*/0 * * * *', '1-2-3 * * * *']) {
      expect(() => parseCron(bad), bad).toThrow();
    }
  });

  it('finds the next daily run', () => {
    const from = new Date(2026, 0, 15, 8, 30, 0); // Jan 15 08:30 local
    const [n] = nextRuns('0 9 * * *', from, 1);
    expect(n.getHours()).toBe(9);
    expect(n.getMinutes()).toBe(0);
    expect(n.getDate()).toBe(15);
  });

  it('rolls over to the next day when time passed', () => {
    const from = new Date(2026, 0, 15, 10, 0, 0);
    const [n] = nextRuns('0 9 * * *', from, 1);
    expect(n.getDate()).toBe(16);
  });

  it('returns ascending runs', () => {
    const from = new Date(2026, 0, 15, 0, 0, 0);
    const runs = nextRuns('*/30 * * * *', from, 4);
    expect(runs).toHaveLength(4);
    for (let i = 1; i < runs.length; i++) expect(runs[i].getTime()).toBeGreaterThan(runs[i - 1].getTime());
    expect(runs[0].getMinutes() % 30).toBe(0);
  });

  it('honours weekday restriction', () => {
    // Sat Jan 17 2026; next Monday 9:00 is Jan 19
    const from = new Date(2026, 0, 17, 12, 0, 0);
    const [n] = nextRuns('0 9 * * MON', from, 1);
    expect(n.getDay()).toBe(1);
    expect(n.getDate()).toBe(19);
  });

  it('describes schedules in plain english', () => {
    expect(describeCron('* * * * *')).toMatch(/every minute/i);
    expect(describeCron('0 9 * * MON-FRI')).toMatch(/9:00.*weekday/i);
    expect(describeCron('*/15 * * * *')).toMatch(/15 minutes/i);
  });
});

import { describe, it, expect } from "vitest";
import { isDue, missingStops, type RouteTemplate } from "@/lib/recurring";

const base: RouteTemplate = {
  id: "a", name: "R", driver_id: 1, bin_ids: [10, 20, 30],
  weekdays: [0, 1, 2, 3, 4, 5, 6], start_date: "2026-10-18", end_date: null, active: true,
};

describe("recurring routes", () => {
  it("forever template keeps running years later", () => {
    expect(isDue(base, "2029-01-01")).toBe(true);
  });
  it("stops after the end date", () => {
    expect(isDue({ ...base, end_date: "2026-10-31" }, "2026-11-01")).toBe(false);
  });
  it("respects chosen weekdays (2026-10-18 is Sunday)", () => {
    expect(isDue({ ...base, weekdays: [1] }, "2026-10-18")).toBe(false);
    expect(isDue({ ...base, weekdays: [0] }, "2026-10-18")).toBe(true);
  });
  it("does not duplicate tasks that already exist", () => {
    const m = missingStops(base, "2026-10-18", [{ driver_id: 1, bin_id: 20, task_date: "2026-10-18" }]);
    expect(m).toEqual([{ bin_id: 10, route_order: 1 }, { bin_id: 30, route_order: 3 }]);
  });
});

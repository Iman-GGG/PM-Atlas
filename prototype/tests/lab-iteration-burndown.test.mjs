import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { publicLabCaseBaseline } from "../lib/lab/lab-case-public.generated.ts";

const timelineSource = new URL("../app/lab-timeline-page.tsx", import.meta.url);
const dashboardComponentsSource = new URL("../app/lab-dashboard-components.tsx", import.meta.url);

test("publishes a minimal authoritative iteration task source for W9 through W28", () => {
  const iterations = publicLabCaseBaseline.plans.iterations;
  const activities = new Map(publicLabCaseBaseline.plans.schedule.activities.map((activity) => [activity.id, activity]));
  const requirements = new Set(publicLabCaseBaseline.plans.requirements.requirements.map((requirement) => requirement.id));
  const taskIds = new Set();

  assert.equal(iterations.policy.estimationUnit, "story_point");
  assert.equal(iterations.sprints.length, 10);
  assert.deepEqual(iterations.sprints.map((sprint) => [sprint.startWeek, sprint.endWeek]), [
    [9, 10], [11, 12], [13, 14], [15, 16], [17, 18],
    [19, 20], [21, 22], [23, 24], [25, 26], [27, 28],
  ]);

  for (const sprint of iterations.sprints) {
    assert.equal(sprint.tasks.length, 3);
    for (const task of sprint.tasks) {
      assert.equal(taskIds.has(task.id), false, `duplicate iteration task ${task.id}`);
      taskIds.add(task.id);
      const activity = activities.get(task.scheduleActivityId);
      assert.ok(activity, `missing schedule activity ${task.scheduleActivityId}`);
      assert.ok(activity.startWeek <= sprint.endWeek && activity.endWeek >= sprint.startWeek);
      assert.ok(task.requirementIds.every((requirementId) => requirements.has(requirementId)));
      assert.ok(Number.isInteger(task.storyPoints) && task.storyPoints > 0);
      assert.ok(Number.isInteger(task.completedWorkday) && task.completedWorkday >= 1 && task.completedWorkday <= 10);
    }
  }
  assert.equal(taskIds.size, 30);
});

test("derives each burn-down series from task points and completion days", () => {
  const totals = [];
  for (const sprint of publicLabCaseBaseline.plans.iterations.sprints) {
    const total = sprint.tasks.reduce((sum, task) => sum + task.storyPoints, 0);
    const remaining = Array.from({ length: 11 }, (_, day) => (
      sprint.tasks
        .filter((task) => task.completedWorkday > day)
        .reduce((sum, task) => sum + task.storyPoints, 0)
    ));
    totals.push(total);
    assert.equal(remaining[0], total);
    assert.equal(remaining[10], 0);
    assert.equal(remaining.every((value, index) => index === 0 || value <= remaining[index - 1]), true);
  }
  assert.ok(new Set(totals).size > 1, "iteration totals should reflect the task mix instead of a fixed template");
  assert.equal(totals.includes(34), false);
});

test("renders the burn-down from iteration tasks without a fixed demonstration curve", async () => {
  const timeline = (await Promise.all([
    timelineSource,
    dashboardComponentsSource,
  ].map((source) => readFile(source, "utf8")))).join("\n");
  assert.match(timeline, /sprint\.tasks\.reduce\(\(total, task\) => total \+ task\.storyPoints, 0\)/);
  assert.match(timeline, /task\.completedWorkday > day/);
  assert.match(timeline, /currentSprint = mainline\.iterations\?\.sprints\.find/);
  assert.match(timeline, /该冻结版本未记录迭代任务/);
  assert.doesNotMatch(timeline, /const totalWork = 34/);
  assert.doesNotMatch(timeline, /const checkpoints = \[/);
});

(() => {
  function weightedRandom<Type>(pairs: [Type, number][]): Type | null {
    var total = 0;
    for (let pair of pairs) {
      total += pair[1];
    }

    let target = Math.random() * total;
    for (let pair of pairs) {
      target -= pair[1];

      if (target <= 0) {
        return pair[0];
      }
    }

    return null;
  }

  class FlagTasks {
    tagWeights: { [key: string]: number };
    tasks: Task[];

    wantFlagged: number;
    currentlyFlagged: number;

    constructor(wantFlagged: number, tagWeights: { [key: string]: number }) {
      this.tagWeights = tagWeights;

      this.tasks = flattenedProjects
        .filter((p) => p.status == Project.Status.Active)
        .flatMap((p) =>
          p.flattenedTasks.filter(
            (t: Task) =>
              t.taskStatus == Task.Status.Available ||
              t.taskStatus == Task.Status.DueSoon ||
              t.taskStatus == Task.Status.Next ||
              t.taskStatus == Task.Status.Overdue
          )
        );

      this.wantFlagged = wantFlagged;
      this.currentlyFlagged = this.tasks.filter((t) => t.flagged).length;
    }

    enact(): void {
      if (this.currentlyFlagged > this.wantFlagged) {
        return;
      }

      let now = new Date();

      let weightedTasks: [Task, number][] = [];

      for (let task of this.tasks) {
        let weight = 0;

        // tasks that are closer to their due date should be weighted higher, up
        // to three weeks out
        if (task.effectiveDueDate) {
          weight += Math.max(
            0,
            21 - this.daysBetween(now, task.effectiveDueDate)
          );
        }

        // tasks that have been deferred should grow in urgency from their
        // deferral date. This includes repeating tasks! Otherwise, they should
        // grow in urgency according to when they were created. If both dates
        // are somehow null, it's OK to not add any weight to the task.
        weight += Math.max(
          14,
          this.daysBetween(now, task.effectiveDeferDate || task.added || now)
        );

        // add weights from tags
        weight += this.tagWeightsForTask(task);

        weightedTasks.push([task, weight]);
      }

      if (weightedTasks.length === 0) {
        new Alert(
          "Problem choosing tasks",
          "Weighted tasks array was empty!"
        ).show();
        return;
      }

      while (this.currentlyFlagged < this.wantFlagged) {
        let next = null;
        while (!next || next.flagged) {
          next = weightedRandom(weightedTasks);
        }

        next.flagged = true;
        this.currentlyFlagged++;
      }
    }

    tagWeightsForTask(task: Task): number {
      var weight = 0;

      var todo = task.tags;
      var seen: Tag[] = [];
      while (todo.length !== 0) {
        let tag = todo.pop();
        if (seen.indexOf(tag) !== -1) {
          continue;
        }

        weight += this.tagWeights[tag.name] || 0;
        if (tag.parent) {
          todo.push(tag.parent);
        }
        seen.push(tag);
      }

      return weight;
    }

    daysBetween(a: Date, b: Date): number {
      let millis = Math.abs(a.getTime() - b.getTime());
      return millis / 1000 / 60 / 60 / 24;
    }
  }

  function getDuringWorkHours(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    return hour >= 8 && hour <= 17 && day != 0 && day != 6;
  }

  var action = new PlugIn.Action(async () => {
    try {
      let weights: Record<string, number> = {};
      if (getDuringWorkHours()) {
        weights = {
          work: 4,
          Kraken: 2,
          "Wandering Toolmaker": 2,
          "from Linear": 8,
          "from GitHub": 8,
        };
      } else {
        weights = {
          personal: 4,
          hobbies: 2,
          house: 2,
          reading: 6,
        };
      }

      new FlagTasks(5, weights).enact();
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  return action;
})();

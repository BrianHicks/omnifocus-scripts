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

  type Method = "random" | "top";

  class FlagTasks {
    tagWeights: { [key: string]: number };
    tasks: Task[];

    method: Method;

    wantFlagged: number;
    currentlyFlagged: number;

    constructor(
      wantFlagged: number,
      tagWeights: { [key: string]: number },
      method: Method
    ) {
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

      this.method = method;

      this.wantFlagged = wantFlagged;
      this.currentlyFlagged = this.tasks.filter((t) => t.flagged).length;
    }

    enact(): void {
      if (this.currentlyFlagged >= this.wantFlagged) {
        console.log(
          `we have ${this.currentlyFlagged} tasks, and want ${this.wantFlagged}, so we're just done.`
        );
        return;
      }

      let now = new Date();

      let weightedTasks: [Task, number][] = [];

      for (let task of this.tasks) {
        // start with weights from tags
        let weight = this.tagWeightsForTask(task);
        if (!weight) {
          console.log(`skipping ${task.name} because no tags matched.`);
          continue;
        }

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

        weightedTasks.push([task, weight]);
      }

      if (weightedTasks.length === 0) {
        new Alert(
          "Problem choosing tasks",
          "Weighted tasks array was empty!"
        ).show();
        return;
      }

      weightedTasks.sort(
        ([_taskA, weightA], [_taskB, weightB]) => weightB - weightA
      );

      while (
        this.currentlyFlagged < this.wantFlagged &&
        weightedTasks.length >= 1
      ) {
        let next: Task | null = null;
        while (!next || next.flagged) {
          switch (this.method) {
            case "random":
              next = weightedRandom(weightedTasks);
              weightedTasks = weightedTasks.filter(
                ([task, _]) => task.id !== next?.id
              );
              break;

            case "top":
              let nexts = weightedTasks.shift();
              if (!nexts) {
                return;
              }
              next = nexts[0];
              break;

            default:
              throw "unreachable";
          }
        }

        next.flagged = true;
        this.currentlyFlagged++;
      }
    }

    tagWeightsForTask(task: Task): null | number {
      // we return a null weight if no tags match, because we don't want to
      // choose tasks that don't match any tags.
      var weight = null;

      var todo = task.tags;
      var seen: Tag[] = [];
      while (todo.length !== 0) {
        let tag = todo.pop();
        if (seen.indexOf(tag) !== -1) {
          continue;
        }

        if (this.tagWeights[tag.name]) {
          weight = (weight || 0) + this.tagWeights[tag.name];
        }

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

  function isWorkday(now?: Date): boolean {
    now = now || new Date();
    let day = now.getDay();

    return day != 0 && day != 6;
  }

  function isMorning(now?: Date): boolean {
    now = now || new Date();
    let hour = now.getHours();

    return hour >= 8 && hour <= 12;
  }

  function isAfternoon(now?: Date): boolean {
    now = now || new Date();
    let hour = now.getHours();
    let minute = now.getMinutes();

    return hour >= 13 && (hour == 17 ? minute <= 30 : hour < 17);
  }

  function isWorkHours(now?: Date): boolean {
    now = now || new Date();

    return isMorning(now) || isAfternoon(now);
  }

  var action = new PlugIn.Action(async () => {
    try {
      let count: number = 5;
      let weights: Record<string, number> = {};
      let method: Method = "top";

      let now = new Date();

      if (isWorkday(now) && isWorkHours(now) && !app.shiftKeyDown) {
        method = isMorning(now) ? "top" : "random";
        weights = {
          work: 4,
          Kraken: 2,
          "Wandering Toolmaker": 2,
          "from Linear": 8,
          "from GitHub": 8,
          habit: 10,
          learning: 2,
          personal: 1,
          notes: 1,
        };
      } else {
        method = "random";
        weights = {
          Anne: 10,
          personal: 4,
          hobbies: 2,
          house: 2,
          learning: 6,
          habit: 1,
        };
      }

      new FlagTasks(count, weights, method).enact();
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  return action;
})();

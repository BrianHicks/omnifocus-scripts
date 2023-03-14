(() => {
  interface Numberlike {
    toNumber(): number;
  }

  function weightedRandom<T extends Numberlike>(values: T[]): T | null {
    var total = 0;
    for (let value of values) {
      total += value.toNumber();
    }

    let target = Math.random() * total;
    for (let value of values) {
      target -= value.toNumber();

      if (target <= 0) {
        return value;
      }
    }

    return null;
  }

  class TaskScore {
    task: Task;
    fromTags: number | null;
    daysUntilDue: number | null;
    daysOld: number;

    constructor(
      task: Task,
      fromTags: number | null,
      daysUntilDue: number | null,
      daysOld: number
    ) {
      this.task = task;
      this.fromTags = fromTags;
      this.daysUntilDue = daysUntilDue;
      this.daysOld = daysOld;
    }

    toString(): string {
      return `${
        this.task.name
      }: ${this.toNumber()} with ${this.tagScore()} from tags, ${this.dueScore()} from due date, and ${this.ageScore()} from age`;
    }

    tagScore(): number {
      return this.fromTags || 0;
    }

    dueScore(): number {
      if (!this.daysUntilDue) {
        return 0;
      }

      return Math.max(0, 21 - this.daysUntilDue);
    }

    ageScore(): number {
      return this.daysOld;
    }

    toNumber(): number {
      return this.tagScore() + this.dueScore() + this.ageScore();
    }
  }

  class TaskScorer {
    tagWeights: { [key: string]: number };

    constructor(tagWeights: { [key: string]: number }) {
      this.tagWeights = tagWeights;
    }

    score(task: Task): TaskScore | null {
      // start with weights from tags
      const fromTags = this.scoreFromTags(task);
      if (!fromTags) {
        console.log(`skipping ${task.name} because no tags matched.`);
        return null;
      }

      const now = new Date();

      // tasks that are closer to their due date should be weighted higher, up
      // to three weeks out
      let daysUntilDue = null;
      if (task.effectiveDueDate) {
        daysUntilDue = this.daysBetween(now, task.effectiveDueDate);
      }

      // tasks that have been deferred should grow in urgency from their
      // deferral date. This includes repeating tasks! Otherwise, they should
      // grow in urgency according to when they were created. If both dates
      // are somehow null, it's OK to not add any weight to the task.
      const daysOld = this.daysBetween(
        now,
        task.deferDate || task.added || now
      );

      return new TaskScore(task, fromTags, daysUntilDue, daysOld);
    }

    scoreFromTags(task: Task): null | number {
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
      return Math.ceil(millis / 1000 / 60 / 60 / 24);
    }
  }

  type Method = "random" | "top";

  class FlagTasks {
    scorer: TaskScorer;
    tasks: Task[];

    method: Method;

    wantFlagged: number;
    currentlyFlagged: number;

    constructor(
      wantFlagged: number,
      tagWeights: { [key: string]: number },
      method: Method
    ) {
      this.scorer = new TaskScorer(tagWeights);

      this.tasks = flattenedProjects
        .filter((p) => p.status == Project.Status.Active)
        .flatMap((p) =>
          p.flattenedTasks.filter(
            (t: Task) =>
              t.children.length == 0 &&
              (t.taskStatus == Task.Status.Available ||
                t.taskStatus == Task.Status.DueSoon ||
                t.taskStatus == Task.Status.Next ||
                t.taskStatus == Task.Status.Overdue)
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

      let scored: TaskScore[] = [];
      this.tasks.forEach((task) => {
        let maybeScore = this.scorer.score(task);
        if (maybeScore) {
          scored.push(maybeScore);
        }
      });

      scored.sort((a, b) => b.toNumber() - a.toNumber());

      if (scored.length === 0) {
        new Alert(
          "Problem choosing tasks",
          "Weighted tasks array was empty!"
        ).show();
        return;
      }

      while (this.currentlyFlagged < this.wantFlagged && scored.length >= 1) {
        let next: TaskScore | null = null;
        while (!next || next.task.flagged) {
          switch (this.method) {
            case "random":
              next = weightedRandom(scored);
              scored = scored.filter((score) => score === next);
              break;

            case "top":
              let draftNext = scored.shift();
              if (!draftNext) {
                // we've run out of tasks to choose
                return;
              }
              next = draftNext;
              break;

            default:
              throw "unreachable";
          }
        }

        console.log(`chose ${next}`);
        next.task.flagged = true;
        this.currentlyFlagged++;
      }
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

    return hour >= 8 && hour < 12;
  }

  function isEarlyAfternoon(now?: Date): boolean {
    now = now || new Date();
    let hour = now.getHours();
    let minute = now.getMinutes();

    return hour >= 12 && hour < 15;
  }

  function isLateAfternoon(now?: Date): boolean {
    now = now || new Date();
    let hour = now.getHours();
    let minute = now.getMinutes();

    return hour >= 15 && (hour == 17 ? minute <= 30 : hour < 17);
  }

  function isWorkHours(now?: Date): boolean {
    now = now || new Date();

    return isMorning(now) || isEarlyAfternoon(now) || isLateAfternoon(now);
  }

  var action = new PlugIn.Action(async () => {
    try {
      let count: number = 5;
      let weights: Record<string, number> = {};
      let method: Method = "top";

      let now = new Date();

      let isWork = isWorkday(now) && isWorkHours(now);
      if (app.shiftKeyDown) {
        isWork = !isWork;
      }

      if (isWork) {
        method = isLateAfternoon(now) ? "random" : "top";
        if (app.optionKeyDown) {
          if (method == "random") {
            method = "top";
          } else {
            method = "random";
          }
        }

        weights = {
          "from GitHub": 8,
          "from Linear": 8,
          habit: 8,
          work: 4,
          Adminotaurs: 2,
          learning: 2,
          "Wandering Toolmaker": 2,
          notes: 1,
          personal: 1,
        };
      } else {
        method = "random";
        weights = {
          Anne: 8,
          learning: 4,
          nonwork: 4,
          personal: 4,
          hobbies: 2,
          habit: 1,
          house: 2,
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

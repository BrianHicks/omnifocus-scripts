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

  class ChooseATask {
    readonly name = "Choose a Task";

    tagWeights: { [key: string]: number };
    tasks: Task[];

    constructor(tagWeights: { [key: string]: number }) {
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
    }

    weight(): number {
      return this.tasks.length;
    }

    enact() {
      let now = new Date();

      let weightedTasks: [Task, number][] = [];

      for (let task of this.tasks) {
        let weight = 0;

        // start off by weighting based on tags
        weight += this.tagWeightsForTask(task);

        // weight stale-er tasks higher, up to 7 days
        if (task.modified) {
          weight += Math.min(7, this.daysBetween(now, task.modified)) / 7;
        }

        // weight due-er tasks higher, up to 100 points
        if (task.effectiveDueDate) {
          weight += 100 - this.daysBetween(now, task.effectiveDueDate);
        }

        // weight recurring tasks higher
        if (task.repetitionRule && task.effectiveDeferDate) {
          weight += Math.max(
            14,
            this.daysBetween(now, task.effectiveDeferDate) * 2
          );
        } else if (task.effectiveDeferDate) {
          weight += Math.max(7, this.daysBetween(now, task.effectiveDeferDate)) / 2;
        } else if (task.added) {
          weight += Math.max(7, this.daysBetween(now, task.added)) / 2;
        }

        console.log(`${Math.round(weight * 100) / 100}\t${task.name}`);
        weightedTasks.push([task, weight]);
      }

      let chosenTask = weightedRandom(weightedTasks);
      if (chosenTask) {
        console.log(`chosen task: ${chosenTask.name}`);

        document.windows[0].perspective = Perspective.BuiltIn.Projects;
        if (chosenTask.containingProject) {
          document.windows[0].focus = [
            chosenTask.containingProject,
          ] as SectionArray;
        }
        document.windows[0].selectObjects([chosenTask]);
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
      let duringWorkHours = getDuringWorkHours();
      let weights = {};
      if (duringWorkHours) {
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

      let strategies = [
        new ChooseATask(weights),
      ];

      let weightedStrategies: [ChooseATask, number][] = [];
      strategies.forEach((s) => {
        let weight = s.weight();

        if (weight) {
          weightedStrategies.push([s, weight]);
        } else {
          console.log(`skipping ${s.name}`);
        }
      });

      for (let pair of weightedStrategies) {
        console.log(`weights: ${pair[0].name} was ${pair[1]}`);
      }

      let chosen = weightedRandom(weightedStrategies);
      if (chosen) {
        console.log(`chose ${chosen.name}`);
        chosen.enact();
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  return action;
})();

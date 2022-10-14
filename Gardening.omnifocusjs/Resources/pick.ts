(() => {
  let creds = new Credentials();

  var getWeights = function (): { work: number; personal: number } {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    if (hour >= 8 && hour <= 17 && day != 0 && day != 6) {
      return { work: 0.8, personal: 0.2 };
    } else {
      return { work: 0.8, personal: 0.2 };
      return { work: 0.0, personal: 1.0 };
    }
  };

  var categorizeTask = function (task: Task): "work" | "personal" | null {
    var todo = task.tags;
    while (todo.length != 0) {
      let tag = todo.pop();

      if (tag.name == "work") {
        return "work";
      } else if (tag.name == "personal") {
        return "personal";
      } else if (tag.parent) {
        todo.push(tag.parent);
      }
    }

    return null;
  };

  var daysBetween = function (a: Date, b: Date): number {
    let millis = Math.abs(a.getTime() - b.getTime());
    return millis / 1000 / 60 / 60 / 24;
  };

  var weightedRandom = function <Type>(pairs: [Type, number][]): Type | null {
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
  };

  var chooseATask = function (): Task | null {
    let weights = getWeights();
    let now = new Date();

    let possibleTasks = flattenedProjects
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

    let weightedTasks: [Task, number][] = [];

    for (let task of possibleTasks) {
      // weight some categories higher than others
      let categoryWeight = 0;
      let category = categorizeTask(task);
      if (category) {
        categoryWeight = weights[category];
      }

      // weight stale-er tasks higher, up to 7 days
      let ageWeight = Math.min(7, daysBetween(now, task.modified)) / 7;

      // weight due-er tasks higher, up to 100 points
      let dueWeight = 0;
      if (task.effectiveDueDate) {
        dueWeight = 100 - daysBetween(now, task.effectiveDueDate);
      }

      weightedTasks.push([task, ageWeight + dueWeight + categoryWeight]);
    }

    return weightedRandom(weightedTasks);
  };

  var action = new PlugIn.Action(async () => {
    try {
      console.log(`task: ${chooseATask()}`);
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  return action;
})();

(() => {
  interface Strategy {
    weight(): number;
    enact(): void;
  }

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

  class ProcessInbox implements Strategy {
    weight(): number {
      return inbox.filter(
        (t: Task) =>
          t.taskStatus == Task.Status.Available ||
          t.taskStatus == Task.Status.DueSoon ||
          t.taskStatus == Task.Status.Next ||
          t.taskStatus == Task.Status.Overdue
      ).length;
    }

    enact() {
      document.windows[0].perspective = Perspective.BuiltIn.Inbox;
      document.windows[0].focus = null;
    }
  }

  class ReviewProjects implements Strategy {
    weight(): number {
      let now = new Date();
      return flattenedProjects.filter(
        (p) =>
          p.nextReviewDate <= now &&
          (p.status == Project.Status.Active ||
            p.status == Project.Status.OnHold)
      ).length;
    }

    enact() {
      document.windows[0].perspective = Perspective.BuiltIn.Review;
      document.windows[0].focus = null;

      let prompts = [
        "How will doing this project make the world a better place?",
        "Will doing this project bring me joy?",
        "Will doing this project get me closer to my goals?",
        "Why did I add this project in the first place?",
        "If I randomly got a task from this project in the next week, would I want to do it?",
        "Who benefits most from me doing this?",
      ];
      let prompt = prompts[Math.floor(Math.random() * prompts.length)];

      let alert = new Alert(
        "Review Projects",
        `Review at least one project, considering this prompt:\n\n${prompt}`
      );
      alert.show();
    }
  }

  class PullWork implements Strategy {
    weight(): number {
      // We could get a nicer weight here by looking at the available work
      // remotely, but it requires a lot of HTTP calls and caching. Meh.
      //
      // A simpler measure here is that it's nicer to pull work at the beginning
      // and at the end of the workday. Or, more concretely, it's nicer to pull
      // work before you do any or after you do a bunch.
      let today = new Date();
      let averageTasksPerDay = 17.2; // August, September, October 1-14 2022

      let completedTasks = flattenedTasks.filter((task: Task) => {
        let completed = task.effectiveCompletedDate;
        if (completed === null) {
          return false;
        }

        return (
          today.getFullYear() == completed.getFullYear() &&
          today.getMonth() == completed.getMonth() &&
          today.getDay() == completed.getDay()
        );
      });

      return Math.min(
        averageTasksPerDay,
        Math.abs(averageTasksPerDay / 2 - completedTasks.length) * 2
      );
    }

    enact() {
      let sources = ["Linear", "GitHub", "your email"];
      let source = sources[Math.floor(Math.random() * sources.length)];

      let alert = new Alert(
        "Pull Work",
        `Go check ${source} for new work and get it tracked in here!`
      );
      alert.show();
    }
  }

  class ChooseATask implements Strategy {
    tasks: Task[];

    constructor() {
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
      let weights = this.getWeights();
      let now = new Date();

      let weightedTasks: [Task, number][] = [];

      for (let task of this.tasks) {
        // weight some categories higher than others
        let categoryWeight = 0;
        let category = this.categorizeTask(task);
        if (category) {
          categoryWeight = weights[category];
        }

        // weight stale-er tasks higher, up to 7 days
        let ageWeight = 0;
        if (task.modified) {
          ageWeight = Math.min(7, this.daysBetween(now, task.modified)) / 7;
        }

        // weight due-er tasks higher, up to 100 points
        let dueWeight = 0;
        if (task.effectiveDueDate) {
          dueWeight = 100 - this.daysBetween(now, task.effectiveDueDate);
        }

        weightedTasks.push([task, ageWeight + dueWeight + categoryWeight]);
      }

      let chosenTask = weightedRandom(weightedTasks);
      if (chosenTask) {
        document.windows[0].perspective = Perspective.BuiltIn.Projects;
        if (chosenTask.containingProject) {
          document.windows[0].focus = [
            chosenTask.containingProject,
          ] as SectionArray;
        }
        document.windows[0].selectObjects([chosenTask]);
      }
    }

    getWeights(): { work: number; personal: number } {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();

      // TODO: weight phone calls during business hours too

      if (hour >= 8 && hour <= 17 && day != 0 && day != 6) {
        return { work: 0.9, personal: 0.1 };
      } else {
        return { work: 0.0, personal: 1.0 };
      }
    }

    categorizeTask(task: Task): "work" | "personal" | null {
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
    }

    daysBetween(a: Date, b: Date): number {
      let millis = Math.abs(a.getTime() - b.getTime());
      return millis / 1000 / 60 / 60 / 24;
    }
  }

  var action = new PlugIn.Action(async () => {
    try {
      // TODO: more strategies:
      //
      // - reflection prompts (constant weight)
      // - stuff stolen from Taylor's nowify prompts
      let strategies = [
        new ProcessInbox(),
        new ReviewProjects(),
        new ChooseATask(),
        new PullWork(),
      ];

      let weightedStrategies: [Strategy, number][] = strategies.map((s) => [
        s,
        s.weight(),
      ]);

      let chosen = weightedRandom(weightedStrategies);
      if (chosen) {
        chosen.enact();
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  return action;
})();

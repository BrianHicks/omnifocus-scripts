(() => {
  interface Strategy {
    name: string;
    weight(): null | number;
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

  function choose<Type>(items: Type[]): Type {
    if (items.length === 0) {
      throw "cannot choose from an empty list";
    }

    return items[Math.floor(Math.random() * items.length)];
  }

  class ProcessInbox implements Strategy {
    readonly name = "Process Inbox";

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

  function hoursBetween(a: Date, b: Date): number {
    let millis = Math.abs(a.getTime() - b.getTime());
    return millis / 1000 / 60 / 60;
  }

  class CheckEmail implements Strategy {
    readonly name = "Check Email";

    readonly onlyEveryHours: number;
    readonly pref: Preferences;
    readonly prefName = "task picker email task";
    readonly prefKey = "last check";

    constructor(onlyEveryHours: number) {
      this.onlyEveryHours = onlyEveryHours;
      this.pref = new Preferences(this.prefName);
    }

    weight(): null | number {
      let lastCheck = this.pref.readDate(this.prefKey);
      if (
        lastCheck &&
        hoursBetween(lastCheck, new Date()) < this.onlyEveryHours
      ) {
        console.log("checked email too recently; skipping!");
        return null;
      }

      return 5;
    }

    enact() {
      this.pref.write(this.prefKey, new Date());

      new Alert(
        "Check your email",
        "Get as many items out of the inbox as possible!"
      ).show();
    }
  }

  class UpdateDailyLog implements Strategy {
    readonly name = "Update Daily Log";

    readonly onlyEveryHours: number;
    readonly pref: Preferences;
    readonly prefName = "task picker logging task";
    readonly prefKey = "last update";

    constructor(onlyEveryHours: number) {
      this.onlyEveryHours = onlyEveryHours;
      this.pref = new Preferences(this.prefName);
    }

    weight(): null | number {
      let lastCheck = this.pref.readDate(this.prefKey);
      let timeSince = hoursBetween(
        lastCheck || new Date(1970, 1, 1),
        new Date()
      );
      if (lastCheck && timeSince < this.onlyEveryHours) {
        console.log("updated log too recently; skipping!");
        return null;
      }

      return 10 * (timeSince / 2);
    }

    enact() {
      let lastCheck = this.pref.readDate(this.prefKey);

      new Alert(
        "Update the daily log in Obsidian",
        `What's happened since ${lastCheck}?`
      ).show();

      this.pref.write(this.prefKey, new Date());
    }
  }

  class ReviewProjects implements Strategy {
    readonly name = "Review Projects";

    readonly prompts = [
      "How will doing this project make the world a better place?",
      "Will doing this project bring me joy?",
      "Will doing this project get me closer to my goals?",
      "Why did I add this project in the first place?",
      "If I randomly got a task from this project in the next week, would I want to do it?",
      "Who benefits most from me doing this?",
    ];

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

      let prompt = choose(this.prompts);

      let alert = new Alert(
        "Review Projects",
        `Review at least one project, considering this prompt:\n\n${prompt}`
      );
      alert.show();
    }
  }

  class FillEmptyProject implements Strategy {
    readonly name = "Fill Empty Projects";

    projects: Project[];

    constructor() {
      this.projects = flattenedProjects.filter(
        (p) => p.taskStatus == Task.Status.Next
      );
    }

    weight(): number {
      return this.projects.length * 10;
    }

    enact() {
      let project = choose(this.projects);

      document.windows[0].focus = [project] as SectionArray;

      new Alert("Fill in Project", `Add tasks to ${project.name}`).show();
    }
  }

  class PullForTag implements Strategy {
    readonly name: string;
    readonly tag: Tag;
    readonly minimum: number;
    readonly onlyEveryHours: number;

    readonly pref: Preferences;
    readonly prefKey = "last pulled";

    constructor(tagName: string, minimum: number, onlyEveryHours: number) {
      let tag = flattenedTags.byName(tagName);
      if (tag === null) {
        throw `Could not find a tag named "${tagName}"!`;
      }

      this.name = `Pull from "${tagName}"`;
      this.tag = tag;
      this.minimum = minimum;
      this.onlyEveryHours = onlyEveryHours;
      this.pref = new Preferences(`Pull for Tag "${tag}"`);
    }

    weight(): null | number {
      let lastPulled = this.pref.readDate(this.prefKey);
      if (
        lastPulled &&
        hoursBetween(lastPulled, new Date()) < this.onlyEveryHours
      ) {
        console.log(`pulled "${this.tag.name}" too recently; skipping!`);
        return null;
      }

      let activeTagTaskCount = this.tag.availableTasks.length;
      this.tag.flattenedChildren.forEach(
        (child) => (activeTagTaskCount += child.availableTasks.length)
      );

      let weight = Math.max(0, this.minimum - activeTagTaskCount);
      return 100 * (weight / this.minimum);
    }

    enact() {
      this.pref.write(this.prefKey, new Date());
      new Alert("Pull Work", `Add work to the "${this.tag.name}" tag!`).show();
    }
  }

  class ChooseATask implements Strategy {
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
          weight +=
            Math.max(7, this.daysBetween(now, task.effectiveDeferDate)) / 2;
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
        new ProcessInbox(),
        new CheckEmail(2),
        new ReviewProjects(),
        new FillEmptyProject(),
        new PullForTag("from Linear", 1, 1),
        // new PullForTag("from GitHub", 1, 4),
        new UpdateDailyLog(0.5),
      ];

      let weightedStrategies: [Strategy, number][] = [];
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

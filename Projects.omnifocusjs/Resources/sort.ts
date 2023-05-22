/*
WARNING: if you're looking at the file ending in .js and want to make changes,
don't! Modify the .ts file and run `tsc` instead!
*/
(() => {
  function datestamp(date: Date): number {
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDay()
    ).getTime();
  }

  class SortableProject {
    project: Project;
    sortHierarchy: number[];

    constructor(project: Project) {
      this.project = project;
      this.sortHierarchy = this.calculateSortHierarchy();
    }

    calculateSortHierarchy(): number[] {
      // first, sort by status. Active projects first, then ones on hold.
      let status = 0;

      if (this.project.status == Project.Status.Active) {
        status = 2;
      } else if (this.project.status == Project.Status.OnHold) {
        status = 1;
      }

      // second, put "bucket" projects at the bottom.
      let isNotBucket = 1;
      if (this.project.containsSingletonActions) {
        isNotBucket = 0;
      }

      // second, sort by due date (by day.) That is, projects that are due
      // sooner show up first. If that's not set, consider all tasks due today
      // but one year from now.
      let today = new Date();
      let defaultDate = new Date(
        today.getFullYear() + 1,
        today.getMonth(),
        today.getDay()
      );

      let due = -datestamp(this.project.dueDate || defaultDate);

      // third and fourth, sort by status of the tasks this project contains. We
      // want to see projects with due tasks sooner, then projects who have been recently
      // worked.
      let taskDue: null | number = null;
      let mostRecentlyCompleted: null | number = null;

      for (let task of this.project.flattenedTasks as Task[]) {
        if (task.completionDate) {
          if (!mostRecentlyCompleted) {
            mostRecentlyCompleted = datestamp(task.completionDate);
          } else {
            mostRecentlyCompleted = Math.max(
              mostRecentlyCompleted,
              datestamp(task.completionDate)
            );
          }
        }

        if (task.dueDate) {
          if (!taskDue) {
            taskDue = datestamp(task.dueDate);
          } else {
            taskDue = Math.min(taskDue, datestamp(task.dueDate));
          }
        }
      }

      if (!taskDue) {
        taskDue = datestamp(defaultDate);
      }

      if (!mostRecentlyCompleted) {
        mostRecentlyCompleted = 0;
      }

      return [status, isNotBucket, due, taskDue, mostRecentlyCompleted];
    }

    compare(other: SortableProject): number {
      const ourHierarchy = this.sortHierarchy;
      const theirHierarchy: number[] = other.sortHierarchy;
      const maxHierarchyLevel = Math.max(
        ourHierarchy.length,
        theirHierarchy.length
      );

      for (var i = 0; i < maxHierarchyLevel; i++) {
        const ourLevel = ourHierarchy[i];
        const theirLevel = theirHierarchy[i];

        if (!ourLevel) {
          return 1;
        } else if (!theirLevel) {
          return -1;
        } else if (ourHierarchy > theirHierarchy) {
          return -1;
        } else if (theirHierarchy > ourHierarchy) {
          return 1;
        }
      }

      return 0;
    }

    toString(): string {
      return `[Project: ${this.project.name}]`;
    }
  }

  var action = new PlugIn.Action(async (): Promise<void> => {
    try {
      let sortableProjects: SortableProject[] = flattenedProjects
        .filter(
          (p) =>
            p.status !== Project.Status.Done &&
            p.status !== Project.Status.Dropped
        )
        .map((p) => new SortableProject(p));

      sortableProjects.sort((a, b) => a.compare(b));

      // change the perspective so we can see the sort happen
      document.windows[0].perspective = Perspective.BuiltIn.Projects;
      document.windows[0].focus = null;

      let currentProjects = sortableProjects.map((sp) => sp.project);

      for (let i = 0; i < currentProjects.length; i++) {
        let project = currentProjects[i];
        if (i === 0) {
          moveSections([project], library.beginning);
        } else {
          let previousProject = currentProjects[i - 1];

          moveSections([project], previousProject.after);
        }
      }
    } catch (err) {
      console.error(err);
    }
  });

  return action;
})();

(() => {
  var action = new PlugIn.Action(async () => {
    try {
      let toFocus: Project[] = [];

      flattenedProjects
        .filter((p) => p.status == Project.Status.Active)
        .flatMap((p) =>
          p.flattenedTasks.filter(
            (t: Task) =>
              t.flagged &&
              (t.taskStatus == Task.Status.Available ||
                t.taskStatus == Task.Status.DueSoon ||
                t.taskStatus == Task.Status.Next ||
                t.taskStatus == Task.Status.Overdue)
          )
        )
        .forEach((task: Task) => {
          if (
            task.containingProject &&
            toFocus.indexOf(task.containingProject) === -1
          ) {
            toFocus.push(task.containingProject);
          }
        });

      document.windows[0].perspective = Perspective.BuiltIn.Projects;
      document.windows[0].focus = toFocus as SectionArray;
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  return action;
})();

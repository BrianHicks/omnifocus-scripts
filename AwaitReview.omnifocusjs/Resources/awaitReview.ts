(() => {
  var action = new PlugIn.Action(async (selection: Selection) => {
    try {
      let originalTask: Task = selection.tasks[0];
      originalTask.flagged = false;

      let followUp = new Task(
        `follow up for review on "${originalTask.name}"`,
        originalTask
      );

      let when = new Date();
      when.setDate(when.getDate() + 1);

      // make sure we're not following up on a weekend
      while (when.getDay() > 5) {
        when.setDate(when.getDate() + 1);
      }

      // now that we've adjusted the date, set the correct time to defer
      when.setHours(9);
      when.setMinutes(0);
      when.setSeconds(0);
      when.setMilliseconds(0);

      followUp.deferDate = when;
    } catch (err) {
      console.error(err);
      throw err;
    }
  });

  action.validate = function (selection: Selection) {
    return selection.tasks.length === 1;
  };

  return action;
})();

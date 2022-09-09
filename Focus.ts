/*{
  "type": "action",
  "targets": ["omnifocus"],
  "author": "Brian Hicks",
  "identifier": "zone.bytes.focus",
  "version": "1.0",
  "description": "Start a pomodoro for the selected task",
  "label": "Focus",
  "shortLabel": "Focus",
  "paletteLabel": "Focus",
  "image": "clock"
}*/
(() => {
  var action = new PlugIn.Action(async (selection: Selection, sender: any) => {
    try {
      let task = selection.tasks[0]

      let possibleCategories = [
        "Personal",
        "Team",
        "Wandering Toolmaker",
      ];
      let defaultCategory = possibleCategories[0];

      for (let tag of task.tags) {
        if (tag.name == "Wandering Toolmaker") {
          defaultCategory = tag.name;
          break;
        } else if (tag.name == "teams" || (tag.parent && tag.parent.name == "teams") || tag.name == "work" || (tag.parent && tag.parent.name == "work"))  {
          defaultCategory = "Team";
          break;
        } else if (tag.name == "personal" || (tag.parent && tag.parent.name == "personal")) {
          defaultCategory = "Personal";
          break;
        }
      }

      let focusForm = new Form();
      focusForm.addField(new Form.Field.String("project", "Project", task.containingProject ? task.containingProject.name : null));
      focusForm.addField(new Form.Field.Option("category", "Category", possibleCategories, possibleCategories, defaultCategory));
      focusForm.addField(new Form.Field.String("minutes", "Minutes", "25"));

      await focusForm.show("Focus on…", "Start");
      let values = focusForm.values as {
          project: string,
          category: string,
          minutes: string,
      };

      let rawSessionUrl = `session:///start?intent=${encodeURIComponent(values.project)}&categoryName=${encodeURIComponent(values.category)}&duration=${encodeURIComponent(values.minutes)}`
      let sessionUrl = URL.fromString(rawSessionUrl)
      if (sessionUrl === null) {
          throw `failed to parse session string ("${rawSessionUrl}") into a URL`
      }
      sessionUrl.open();
    } catch (err) {
      console.error(err);
    }
  });

  action.validate = function(selection: Selection, sender: any){
    return (selection.tasks.length === 1)
  };

  return action;
})();
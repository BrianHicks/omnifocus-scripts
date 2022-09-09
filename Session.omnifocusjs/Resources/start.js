"use strict";
/*
WARNING: if you're looking at the file ending in .js and want to make changes,
don't! Modify the .ts file and run `tsc` instead!
*/
(() => {
    var action = new PlugIn.Action(async (selection, sender) => {
        try {
            let task = selection.tasks[0];
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
                }
                else if (tag.name == "teams" || (tag.parent && tag.parent.name == "teams") || tag.name == "work" || (tag.parent && tag.parent.name == "work")) {
                    defaultCategory = "Team";
                    break;
                }
                else if (tag.name == "personal" || (tag.parent && tag.parent.name == "personal")) {
                    defaultCategory = "Personal";
                    break;
                }
            }
            let focusForm = new Form();
            focusForm.addField(new Form.Field.String("project", "Project", task.containingProject ? task.containingProject.name : null));
            focusForm.addField(new Form.Field.Option("category", "Category", possibleCategories, possibleCategories, defaultCategory));
            focusForm.addField(new Form.Field.String("minutes", "Minutes", "25"));
            await focusForm.show("Focus on…", "Start");
            let values = focusForm.values;
            let rawSessionUrl = `session:///start?intent=${encodeURIComponent(values.project)}&categoryName=${encodeURIComponent(values.category)}&duration=${encodeURIComponent(values.minutes)}`;
            let sessionUrl = URL.fromString(rawSessionUrl);
            if (sessionUrl === null) {
                throw `failed to parse session string ("${rawSessionUrl}") into a URL`;
            }
            sessionUrl.open();
        }
        catch (err) {
            console.error(err);
        }
    });
    action.validate = function (selection, sender) {
        return (selection.tasks.length === 1);
    };
    return action;
})();

"use strict";
/*
WARNING: if you're looking at the file ending in .js and want to make changes,
don't! Modify the .ts file and run `tsc` instead!
*/
(() => {
    function findCategory(tag) {
        if (tag.name == "Wandering Toolmaker") {
            return tag.name;
        }
        else if (tag.name == "teams" || (tag.parent && tag.parent.name == "teams") || tag.name == "work" || (tag.parent && tag.parent.name == "work")) {
            return "Team";
        }
        else if (tag.name == "personal" || (tag.parent && tag.parent.name == "personal")) {
            return "Personal";
        }
        return null;
    }
    var action = new PlugIn.Action(async (selection, sender) => {
        try {
            let possibleCategories = [
                "Personal",
                "Team",
                "Wandering Toolmaker",
            ];
            let defaultCategory = possibleCategories[0];
            let defaultProject = null;
            let defaultMinutes = "25";
            if (selection.tasks[0]) {
                let task = selection.tasks[0];
                for (let tag of task.tags) {
                    let category = findCategory(tag);
                    if (category !== null) {
                        defaultCategory = category;
                        break;
                    }
                }
                if (task.containingProject) {
                    defaultProject = task.containingProject.name;
                }
            }
            else if (selection.tags[0]) {
                let tag = selection.tags[0];
                defaultProject = tag.name;
                let category = findCategory(tag);
                if (category !== null) {
                    defaultCategory = category;
                }
            }
            else if (selection.projects[0]) {
                let project = selection.projects[0];
                defaultProject = project.name;
                for (let tag of project.tags) {
                    let category = findCategory(tag);
                    if (category !== null) {
                        defaultCategory = category;
                        break;
                    }
                }
            }
            let focusForm = new Form();
            focusForm.addField(new Form.Field.String("project", "Project", defaultProject));
            focusForm.addField(new Form.Field.Option("category", "Category", possibleCategories, possibleCategories, defaultCategory));
            focusForm.addField(new Form.Field.String("minutes", "Minutes", defaultMinutes));
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
        return (selection.tasks.length === 1 || selection.tags.length === 1 || selection.projects.length === 1);
    };
    return action;
})();

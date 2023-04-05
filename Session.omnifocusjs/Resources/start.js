"use strict";
/*
WARNING: if you're looking at the file ending in .js and want to make changes,
don't! Modify the .ts file and run `tsc` instead!
*/
(() => {
    const allCategories = ["Work", "Personal", "Learning"];
    const defaultCategory = "Work";
    function findCategory(tags) {
        let todo = [...tags];
        while (true) {
            const current = todo.pop();
            if (!current) {
                return defaultCategory;
            }
            else if (current.name == "work") {
                return "Work";
            }
            else if (current.name == "personal") {
                return "Personal";
            }
            else if (current.name == "learning") {
                return "Learning";
            }
            else if (current.parent) {
                todo.push(current.parent);
            }
        }
    }
    var action = new PlugIn.Action(async (selection) => {
        try {
            let suggestedCategory = defaultCategory;
            let suggestedProject = null;
            let suggestedMinutes = "25";
            if (selection.tasks[0]) {
                let task = selection.tasks[0];
                suggestedCategory = findCategory(task.tasks);
                if (task.containingProject) {
                    suggestedProject = task.containingProject.name;
                }
            }
            else if (selection.tags) {
                suggestedCategory = findCategory(selection.tags);
            }
            else if (selection.projects[0]) {
                let project = selection.projects[0];
                suggestedProject = project.name;
                suggestedCategory = findCategory(project.tags);
            }
            let focusForm = new Form();
            focusForm.addField(new Form.Field.String("project", "Project", suggestedProject));
            focusForm.addField(new Form.Field.Option("category", "Category", allCategories, allCategories, suggestedCategory));
            focusForm.addField(new Form.Field.String("minutes", "Minutes", suggestedMinutes));
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
    action.validate = function (selection) {
        return (selection.tasks.length === 1 ||
            selection.tags.length === 1 ||
            selection.projects.length === 1);
    };
    return action;
})();

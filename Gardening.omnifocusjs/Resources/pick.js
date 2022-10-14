"use strict";
(() => {
    let creds = new Credentials();
    var getWeights = function () {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        if (hour >= 8 && hour <= 17 && day != 0 && day != 6) {
            return { work: 0.8, personal: 0.2 };
        }
        else {
            return { work: 0.8, personal: 0.2 };
            return { work: 0.0, personal: 1.0 };
        }
    };
    var categorizeTask = function (task) {
        var todo = task.tags;
        while (todo.length != 0) {
            let tag = todo.pop();
            if (tag.name == "work") {
                return "work";
            }
            else if (tag.name == "personal") {
                return "personal";
            }
            else if (tag.parent) {
                todo.push(tag.parent);
            }
        }
        return null;
    };
    var daysBetween = function (a, b) {
        let millis = Math.abs(a.getTime() - b.getTime());
        return millis / 1000 / 60 / 60 / 24;
    };
    var weightedRandom = function (pairs) {
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
    var chooseATask = function () {
        let weights = getWeights();
        let now = new Date();
        let possibleTasks = flattenedProjects
            .filter((p) => p.status == Project.Status.Active)
            .flatMap((p) => p.flattenedTasks.filter((t) => t.taskStatus == Task.Status.Available ||
            t.taskStatus == Task.Status.DueSoon ||
            t.taskStatus == Task.Status.Next ||
            t.taskStatus == Task.Status.Overdue));
        let weightedTasks = [];
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
        let chosenTask = weightedRandom(weightedTasks);
        if (chosenTask) {
            document.windows[0].perspective = Perspective.BuiltIn.Projects;
            if (chosenTask.containingProject) {
                document.windows[0].focus = [
                    chosenTask.containingProject,
                ];
            }
            document.windows[0].selectObjects([chosenTask]);
        }
    };
    var action = new PlugIn.Action(async () => {
        try {
            // TODO: chosoe a strategy randomly from:
            //
            // - process inbox tasks (if any). Weight is number of inbox tasks.
            // - review project (with prompt like "how will this make the world better when it's done?" or "are you going to make any progress on this during the next week?"). Weight is number of unreviewed projects.
            // - reflection prompts (constant weight)
            // - stuff stolen from Taylor's nowify prompts
            // - the "choose a task" strategy below
            chooseATask();
        }
        catch (err) {
            console.error(err);
            throw err;
        }
    });
    return action;
})();

"use strict";
/*
WARNING: if you're looking at the file ending in .js and want to make changes,
don't! Modify the .ts file and run `tsc` instead!
*/
(() => {
    function hourstamp(date) {
        return new Date(date.getFullYear(), date.getMonth(), date.getDay(), date.getHours()).getTime();
    }
    class SortableProject {
        constructor(project) {
            this.project = project;
            this.sortHierarchy = this.calculateSortHierarchy();
        }
        calculateSortHierarchy() {
            // Active projects first, then ones on hold.
            let status = 0;
            if (this.project.status == Project.Status.Active) {
                let now = new Date();
                // If all the tasks in the project are blocked, then it's effectively
                // on hold.
                let allBlocked = this.project.flattenedTasks
                    .map((t) => t.taskStatus === Task.Status.Blocked)
                    .reduce((a, b) => a && b, true);
                if ((this.project.effectiveDeferDate &&
                    this.project.effectiveDeferDate > now) ||
                    allBlocked) {
                    status = 1;
                }
                else {
                    status = 2;
                }
            }
            else if (this.project.status == Project.Status.OnHold) {
                status = 1;
            }
            // Is this task a "bucket" project? Lower, please.
            let isNotBucket = 1;
            if (this.project.containsSingletonActions) {
                isNotBucket = 0;
            }
            // sort by due date (by day.) That is, projects that are due sooner show
            // up first. If that's not set, consider all tasks due today but one year
            // from now. We will consider due tasks that are due sooner than the due
            // date in the next step as well.
            let todaystamp = hourstamp(new Date());
            let due = null;
            if (this.project.dueDate) {
                due = hourstamp(this.project.dueDate);
            }
            // sort by status of the tasks this project contains. We want to see
            // projects with due tasks sooner, then projects who have been recently
            // worked.
            let mostRecentlyActive = null;
            for (let task of this.project.flattenedTasks) {
                if (task.dueDate && task.taskStatus === Task.Status.Next) {
                    if (!due) {
                        due = hourstamp(task.dueDate);
                    }
                    else {
                        due = Math.min(due, hourstamp(task.dueDate));
                    }
                }
                let activeTime = task.completionDate || task.modified || task.added;
                if (activeTime) {
                    if (!mostRecentlyActive) {
                        mostRecentlyActive = hourstamp(activeTime);
                    }
                    else {
                        mostRecentlyActive = Math.min(mostRecentlyActive, hourstamp(activeTime));
                    }
                }
            }
            return [
                due ? todaystamp - due : 0,
                status,
                isNotBucket,
                mostRecentlyActive ? todaystamp - mostRecentlyActive : 0,
            ];
        }
        compare(other) {
            const ourHierarchy = this.sortHierarchy;
            const theirHierarchy = other.sortHierarchy;
            const maxHierarchyLevel = Math.max(ourHierarchy.length, theirHierarchy.length);
            for (var i = 0; i < maxHierarchyLevel; i++) {
                const ourLevel = ourHierarchy[i];
                const theirLevel = theirHierarchy[i];
                if (ourLevel === theirLevel) {
                    continue;
                }
                else if (!ourLevel) {
                    return 1;
                }
                else if (!theirLevel) {
                    return -1;
                }
                else if (ourLevel > theirLevel) {
                    return -1;
                }
                else if (theirLevel > ourLevel) {
                    return 1;
                }
            }
            return 0;
        }
        toString() {
            return `[Project: ${this.project.name}]`;
        }
    }
    var action = new PlugIn.Action(async () => {
        try {
            let sortableProjects = flattenedProjects
                .filter((p) => p.status !== Project.Status.Done &&
                p.status !== Project.Status.Dropped)
                .map((p) => new SortableProject(p));
            sortableProjects.sort((a, b) => a.compare(b));
            // console.log(sortableProjects.map(p => `${p.sortHierarchy.join("\t")}\t${p.project.name}`).join("\n"))
            // change the perspective so we can see the sort happen
            document.windows[0].perspective = Perspective.BuiltIn.Projects;
            document.windows[0].focus = null;
            let currentProjects = sortableProjects.map((sp) => sp.project);
            let previousProject = null;
            for (let i = 0; i < currentProjects.length; i++) {
                let project = currentProjects[i];
                if (!previousProject) {
                    moveSections([project], library.beginning);
                }
                else {
                    moveSections([project], previousProject.after);
                }
                previousProject = project;
            }
        }
        catch (err) {
            console.error(err);
        }
    });
    return action;
})();

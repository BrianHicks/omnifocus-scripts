"use strict";
(() => {
    function weightedRandom(pairs) {
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
    class FlagTasks {
        constructor(wantFlagged, tagWeights) {
            this.tagWeights = tagWeights;
            this.tasks = flattenedProjects
                .filter((p) => p.status == Project.Status.Active)
                .flatMap((p) => p.flattenedTasks.filter((t) => t.taskStatus == Task.Status.Available ||
                t.taskStatus == Task.Status.DueSoon ||
                t.taskStatus == Task.Status.Next ||
                t.taskStatus == Task.Status.Overdue));
            this.wantFlagged = wantFlagged;
            this.currentlyFlagged = this.tasks.filter((t) => t.flagged).length;
        }
        enact() {
            if (this.currentlyFlagged > this.wantFlagged) {
                return;
            }
            let now = new Date();
            let weightedTasks = [];
            for (let task of this.tasks) {
                let weight = 0;
                // tasks that are closer to their due date should be weighted higher, up
                // to three weeks out
                if (task.effectiveDueDate) {
                    weight += Math.max(0, 21 - this.daysBetween(now, task.effectiveDueDate));
                }
                // tasks that have been deferred should grow in urgency from their
                // deferral date. This includes repeating tasks! Otherwise, they should
                // grow in urgency according to when they were created. If both dates
                // are somehow null, it's OK to not add any weight to the task.
                weight += Math.max(14, this.daysBetween(now, task.effectiveDeferDate || task.added || now));
                // add weights from tags
                weight += this.tagWeightsForTask(task);
                weightedTasks.push([task, weight]);
            }
            if (weightedTasks.length === 0) {
                new Alert("Problem choosing tasks", "Weighted tasks array was empty!").show();
                return;
            }
            while (this.currentlyFlagged < this.wantFlagged) {
                let next = null;
                while (!next || next.flagged) {
                    next = weightedRandom(weightedTasks);
                }
                next.flagged = true;
                this.currentlyFlagged++;
            }
        }
        tagWeightsForTask(task) {
            var weight = 0;
            var todo = task.tags;
            var seen = [];
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
        daysBetween(a, b) {
            let millis = Math.abs(a.getTime() - b.getTime());
            return millis / 1000 / 60 / 60 / 24;
        }
    }
    function getDuringWorkHours() {
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        return hour >= 8 && hour <= 17 && day != 0 && day != 6;
    }
    var action = new PlugIn.Action(async () => {
        try {
            let weights = {};
            if (getDuringWorkHours()) {
                weights = {
                    work: 4,
                    Kraken: 2,
                    "Wandering Toolmaker": 2,
                    "from Linear": 8,
                    "from GitHub": 8,
                };
            }
            else {
                weights = {
                    personal: 4,
                    hobbies: 2,
                    house: 2,
                    reading: 6,
                };
            }
            new FlagTasks(5, weights).enact();
        }
        catch (err) {
            console.error(err);
            throw err;
        }
    });
    return action;
})();

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
    function choose(items) {
        if (items.length === 0) {
            throw "cannot choose from an empty list";
        }
        return items[Math.floor(Math.random() * items.length)];
    }
    class ProcessInbox {
        weight() {
            return inbox.filter((t) => t.taskStatus == Task.Status.Available ||
                t.taskStatus == Task.Status.DueSoon ||
                t.taskStatus == Task.Status.Next ||
                t.taskStatus == Task.Status.Overdue).length;
        }
        enact() {
            document.windows[0].perspective = Perspective.BuiltIn.Inbox;
            document.windows[0].focus = null;
        }
    }
    class ReviewProjects {
        constructor() {
            this.prompts = [
                "How will doing this project make the world a better place?",
                "Will doing this project bring me joy?",
                "Will doing this project get me closer to my goals?",
                "Why did I add this project in the first place?",
                "If I randomly got a task from this project in the next week, would I want to do it?",
                "Who benefits most from me doing this?",
            ];
        }
        weight() {
            let now = new Date();
            return flattenedProjects.filter((p) => p.nextReviewDate <= now &&
                (p.status == Project.Status.Active ||
                    p.status == Project.Status.OnHold)).length;
        }
        enact() {
            document.windows[0].perspective = Perspective.BuiltIn.Review;
            document.windows[0].focus = null;
            let prompt = choose(this.prompts);
            let alert = new Alert("Review Projects", `Review at least one project, considering this prompt:\n\n${prompt}`);
            alert.show();
        }
    }
    class PullWork {
        constructor() {
            this.sources = ["Linear", "GitHub", "your email"];
        }
        weight() {
            // We could get a nicer weight here by looking at the available work
            // remotely, but it requires a lot of HTTP calls and caching. Meh.
            //
            // A simpler measure here is that it's nicer to pull work at the beginning
            // and at the end of the workday. Or, more concretely, it's nicer to pull
            // work before you do any or after you do a bunch.
            let today = new Date();
            let averageTasksPerDay = 17.2; // August, September, October 1-14 2022
            let completedTasks = flattenedTasks.filter((task) => {
                let completed = task.effectiveCompletedDate;
                if (completed === null) {
                    return false;
                }
                return (today.getFullYear() == completed.getFullYear() &&
                    today.getMonth() == completed.getMonth() &&
                    today.getDay() == completed.getDay());
            });
            return Math.min(averageTasksPerDay, Math.abs(averageTasksPerDay / 2 - completedTasks.length) * 2);
        }
        enact() {
            let source = choose(this.sources);
            let alert = new Alert("Pull Work", `Go check ${source} for new work and get it tracked in here!`);
            alert.show();
        }
    }
    class DontDoATask {
        constructor() {
            // many of these prompts are inspired by Taylor Troesh's nowify. Big thanks
            // to Taylor for sharing the list that inspired this one!
            //
            // https://taylor.town/projects/nowify
            this.thingsToTry = [
                "Is the house happy?",
                "Is your heart happy?",
                "Have you taken care of your body?",
                "Have you flossed?",
                "Do you have water?",
                "How about a little breath work?",
                "Just sit for a bit.",
                "Have you written down what's been on your mind?",
                "What if everything turned out OK?",
                "How about some push-ups?",
                "How about some chin-ups?",
                "What have you been avoiding?",
                "What's not tracked?",
                "What can you celebrate?",
                "Relax for 10 seconds. Let your mind be a mirror.",
                "Where are you fighting nature?",
                "Where are you embracing nature?",
                "How can you improve the chances of having happy accidents?",
                "What has felt meaningful today?",
                "What has felt meaningless today?",
                "Ask Anne what I've been avoiding.",
                "What's been working really well lately?",
                "What systems haven't been working out so well lately?",
                "Is the work you're doing in line with your values?",
                "What are your values, again?",
                "Where are you wasting time?",
                "Where are you relying on discipline for safety?",
                "What can be automated?",
                "Do you have any time off scheduled? Figure it out!",
                "How can you make what you're doing today more creative or joyful?",
                "What's bugging you?",
                "Are you doing your best to bring joy to others?",
                "Are you doing your best to be joyful?",
                "How can you be present in your life?",
                "Have you made something cool lately?",
                "How about cleaning something?",
                "What don't you need anymore? Could someone else use it?",
                "What could you recycle?",
                "¿Has practicado español en Duolingo?",
                "¿Qué has leído en español recientemente?",
                "It's time for a break. What'd be restful right now?",
                "How about finding something new and different to listen to?",
                "How could things get less boring? Shenaniganize!",
                "Who needs to know about the last thing you did?",
                "Who haven't you talked to in a long time?",
                "Whose expertise could be helpful right now?",
                "When someone is talking, am I listening?",
                "Be people leading people.",
            ];
        }
        weight() {
            // there are a lot here! This constant is gonna need some tweaking over time.
            return this.thingsToTry.length / 3;
        }
        enact() {
            let thingToTry = choose(this.thingsToTry);
            let alert = new Alert("And now for something completely different", thingToTry);
            alert.show();
        }
    }
    class ChooseATask {
        constructor() {
            this.tasks = flattenedProjects
                .filter((p) => p.status == Project.Status.Active)
                .flatMap((p) => p.flattenedTasks.filter((t) => t.taskStatus == Task.Status.Available ||
                t.taskStatus == Task.Status.DueSoon ||
                t.taskStatus == Task.Status.Next ||
                t.taskStatus == Task.Status.Overdue));
        }
        weight() {
            return this.tasks.length;
        }
        enact() {
            let weights = this.getWeights();
            let now = new Date();
            let weightedTasks = [];
            for (let task of this.tasks) {
                // weight some categories higher than others
                let categoryWeight = 0;
                let category = this.categorizeTask(task);
                if (category) {
                    categoryWeight = weights[category];
                }
                // weight stale-er tasks higher, up to 7 days
                let ageWeight = 0;
                if (task.modified) {
                    ageWeight = Math.min(7, this.daysBetween(now, task.modified)) / 7;
                }
                // weight due-er tasks higher, up to 100 points
                let dueWeight = 0;
                if (task.effectiveDueDate) {
                    dueWeight = 100 - this.daysBetween(now, task.effectiveDueDate);
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
        }
        getWeights() {
            const now = new Date();
            const hour = now.getHours();
            const day = now.getDay();
            // TODO: weight phone calls during business hours too
            if (hour >= 8 && hour <= 17 && day != 0 && day != 6) {
                return { work: 2.0, personal: 0.0 };
            }
            else {
                return { work: 0.0, personal: 1.0 };
            }
        }
        categorizeTask(task) {
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
        }
        daysBetween(a, b) {
            let millis = Math.abs(a.getTime() - b.getTime());
            return millis / 1000 / 60 / 60 / 24;
        }
    }
    var action = new PlugIn.Action(async () => {
        try {
            let strategies = [
                new ChooseATask(),
                new DontDoATask(),
                new ProcessInbox(),
                new PullWork(),
                new ReviewProjects(),
            ];
            let weightedStrategies = strategies.map((s) => [
                s,
                s.weight(),
            ]);
            let chosen = weightedRandom(weightedStrategies);
            if (chosen) {
                chosen.enact();
            }
        }
        catch (err) {
            console.error(err);
            throw err;
        }
    });
    return action;
})();

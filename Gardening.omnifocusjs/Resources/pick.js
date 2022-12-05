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
        constructor() {
            this.name = "Process Inbox";
        }
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
    function hoursBetween(a, b) {
        let millis = Math.abs(a.getTime() - b.getTime());
        return millis / 1000 / 60 / 60;
    }
    class CheckEmail {
        constructor(onlyEveryHours) {
            this.name = "Check Email";
            this.prefName = "task picker email task";
            this.prefKey = "last check";
            this.onlyEveryHours = onlyEveryHours;
            this.pref = new Preferences(this.prefName);
        }
        weight() {
            let lastCheck = this.pref.readDate(this.prefKey);
            if (lastCheck &&
                hoursBetween(lastCheck, new Date()) < this.onlyEveryHours) {
                console.log("checked email too recently; skipping!");
                return null;
            }
            return 5;
        }
        enact() {
            this.pref.write(this.prefKey, new Date());
            new Alert("Check your email", "Get as many items out of the inbox as possible!").show();
        }
    }
    class UpdateDailyLog {
        constructor(onlyEveryHours) {
            this.name = "Update Daily Log";
            this.prefName = "task picker logging task";
            this.prefKey = "last update";
            this.onlyEveryHours = onlyEveryHours;
            this.pref = new Preferences(this.prefName);
        }
        weight() {
            let lastCheck = this.pref.readDate(this.prefKey);
            let timeSince = hoursBetween(lastCheck || new Date(1970, 1, 1), new Date());
            if (lastCheck && timeSince < this.onlyEveryHours) {
                console.log("updated log too recently; skipping!");
                return null;
            }
            return 10 * (timeSince / 2);
        }
        enact() {
            let lastCheck = this.pref.readDate(this.prefKey);
            new Alert("Update the daily log in Obsidian", `What's happened since ${lastCheck}?`).show();
            this.pref.write(this.prefKey, new Date());
        }
    }
    class ReviewProjects {
        constructor() {
            this.name = "Review Projects";
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
    class FillEmptyProject {
        constructor() {
            this.name = "Fill Empty Projects";
            this.projects = flattenedProjects.filter((p) => p.taskStatus == Task.Status.Next);
        }
        weight() {
            return this.projects.length * 10;
        }
        enact() {
            let project = choose(this.projects);
            document.windows[0].focus = [project];
            new Alert("Fill in Project", `Add tasks to ${project.name}`).show();
        }
    }
    class PullForTag {
        constructor(tagName, minimum, onlyEveryHours) {
            this.prefKey = "last pulled";
            let tag = flattenedTags.byName(tagName);
            if (tag === null) {
                throw `Could not find a tag named "${tagName}"!`;
            }
            this.name = `Pull from "${tagName}"`;
            this.tag = tag;
            this.minimum = minimum;
            this.onlyEveryHours = onlyEveryHours;
            this.pref = new Preferences(`Pull for Tag "${tag}"`);
        }
        weight() {
            let lastPulled = this.pref.readDate(this.prefKey);
            if (lastPulled &&
                hoursBetween(lastPulled, new Date()) < this.onlyEveryHours) {
                console.log(`pulled "${this.tag.name}" too recently; skipping!`);
                return null;
            }
            let activeTagTaskCount = this.tag.availableTasks.length;
            this.tag.flattenedChildren.forEach((child) => (activeTagTaskCount += child.availableTasks.length));
            let weight = Math.max(0, this.minimum - activeTagTaskCount);
            return 100 * (weight / this.minimum);
        }
        enact() {
            this.pref.write(this.prefKey, new Date());
            new Alert("Pull Work", `Add work to the "${this.tag.name}" tag!`).show();
        }
    }
    class DontDoATask {
        constructor(onlyEveryHours) {
            this.name = "Don't Do a Task";
            this.prefName = "non-task task";
            this.prefKey = "last non-task task";
            // many of these prompts are inspired by Taylor Troesh's nowify. Big thanks
            // to Taylor for sharing the list that inspired this one!
            //
            // https://taylor.town/projects/nowify
            this.thingsToTry = [
                "Is your heart happy?",
                "Have you flossed?",
                "Do you have water?",
                "How about a little breath work?",
                "Just sit for a bit.",
                "Have you written down what's been on your mind?",
                "What if everything turned out OK?",
                "What have you been avoiding?",
                "What's not tracked?",
                "What can you celebrate?",
                "Relax for 10 seconds. Let your mind be a mirror.",
                "How can you improve the chances of having happy accidents?",
                "What has felt meaningful today?",
                "What has felt meaningless today?",
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
                "How can you be present in your life?",
                "Have you made something cool lately?",
                "How about cleaning something?",
                "¿Has practicado español en Duolingo?",
                "¿Qué has leído en español recientemente?",
                "It's time for a break. What'd be restful right now?",
                "How about finding something new and different to listen to?",
                "How could things get less boring? Shenaniganize!",
                "Who needs to know about the last thing you did?",
                "Who haven't you talked to in a long time?",
                "Whose expertise could be helpful right now?",
            ];
            this.onlyEveryHours = onlyEveryHours;
            this.pref = new Preferences(this.prefName);
        }
        weight() {
            let lastCheck = this.pref.readDate(this.prefKey);
            if (lastCheck &&
                hoursBetween(lastCheck, new Date()) < this.onlyEveryHours) {
                console.log("checked email too recently; skipping!");
                return null;
            }
            // there are a lot here! This constant is gonna need some tweaking over time.
            return this.thingsToTry.length / 4;
        }
        enact() {
            this.pref.write(this.prefKey, new Date());
            let thingToTry = choose(this.thingsToTry);
            let alert = new Alert("And now for something completely different", thingToTry);
            alert.show();
        }
    }
    class ChooseATask {
        constructor(tagWeights) {
            this.name = "Choose a Task";
            this.tagWeights = tagWeights;
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
            let now = new Date();
            let weightedTasks = [];
            for (let task of this.tasks) {
                let weight = 0;
                // start off by weighting based on tags
                weight += this.tagWeightsForTask(task);
                // weight stale-er tasks higher, up to 7 days
                if (task.modified) {
                    weight += Math.min(7, this.daysBetween(now, task.modified)) / 7;
                }
                // weight due-er tasks higher, up to 100 points
                if (task.effectiveDueDate) {
                    weight += 100 - this.daysBetween(now, task.effectiveDueDate);
                }
                // weight recurring tasks higher
                if (task.repetitionRule && task.effectiveDeferDate) {
                    weight += Math.max(14, this.daysBetween(now, task.effectiveDeferDate));
                }
                console.log(`${task.name}: ${weight}`);
                weightedTasks.push([task, weight]);
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
            let duringWorkHours = getDuringWorkHours();
            let weights = {};
            if (duringWorkHours) {
                weights = {
                    work: 2,
                    Kraken: 1,
                    "Wandering Toolmaker": 1,
                    "from Linear": 4,
                    "from GitHub": 4,
                };
            }
            else {
                weights = {
                    personal: 2,
                    hobbies: 1,
                    house: 1,
                    reading: 3,
                };
            }
            let strategies = [
                new ChooseATask(weights),
                new DontDoATask(0.5),
                new ProcessInbox(),
                new CheckEmail(2),
                new ReviewProjects(),
                new FillEmptyProject(),
                new PullForTag("from Linear", 1, 1),
                new PullForTag("from GitHub", 1, 4),
                new UpdateDailyLog(0.5),
            ];
            let weightedStrategies = [];
            strategies.forEach((s) => {
                let weight = s.weight();
                if (weight) {
                    weightedStrategies.push([s, weight]);
                }
                else {
                    console.log(`skipping ${s.name}`);
                }
            });
            for (let pair of weightedStrategies) {
                console.log(`weights: ${pair[0].name} was ${pair[1]}`);
            }
            let chosen = weightedRandom(weightedStrategies);
            if (chosen) {
                console.log(`chose ${chosen.name}`);
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

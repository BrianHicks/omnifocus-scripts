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
    class PullForTag {
        constructor(tagName) {
            let tag = flattenedTags.byName(tagName);
            if (tag === null) {
                throw `Could not find a tag named "${tagName}"!`;
            }
            this.tag = tag;
            this.name = `Pull from "${tagName}"`;
        }
        weight() {
            let activeTagTaskCount = this.tag.remainingTasks.length;
            this.tag.flattenedChildren.forEach((child) => (activeTagTaskCount += child.remainingTasks.length));
            if (activeTagTaskCount > 0) {
                return 0;
            }
            else {
                return 100;
            }
        }
        enact() {
            new Alert("Pull Work", `Add work to the "${this.tag.name}" tag!`).show();
        }
    }
    class DontDoATask {
        constructor() {
            this.name = "Don't Do a Task";
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
                "¿Has practicado español en Duolingo?",
                "¿Qué has leído en español recientemente?",
                "It's time for a break. What'd be restful right now?",
                "How about finding something new and different to listen to?",
                "How could things get less boring? Shenaniganize!",
                "Who needs to know about the last thing you did?",
                "Who haven't you talked to in a long time?",
                "Whose expertise could be helpful right now?",
                "When someone is talking, am I listening?",
            ];
        }
        weight() {
            // there are a lot here! This constant is gonna need some tweaking over time.
            return this.thingsToTry.length / 5;
        }
        enact() {
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
                // start off by weighting based on tags
                let tagWeight = this.tagWeightsForTask(task);
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
                weightedTasks.push([task, tagWeight + ageWeight + dueWeight]);
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
                    work: 1,
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
                new DontDoATask(),
                new ProcessInbox(),
                new ReviewProjects(),
                new PullForTag("from Linear"),
                new PullForTag("from GitHub"),
            ];
            let weightedStrategies = strategies.map((s) => [
                s,
                s.weight(),
            ]);
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

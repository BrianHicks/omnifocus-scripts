"use strict";
(() => {
    var action = new PlugIn.Action(async (selection, sender) => {
        try {
            let originalTask = selection.tasks[0];
            originalTask.flagged = false;
            let isDoneAlert = new Alert("Is this task completely done?", originalTask.name);
            isDoneAlert.addOption("Yep!");
            isDoneAlert.addOption("Not quite");
            isDoneAlert.addOption("Whoops, never mind!");
            let isDoneAnswer = await isDoneAlert.show();
            if (isDoneAnswer == 0) {
                ///////////////////////////////
                // Yes, it's completely done //
                ///////////////////////////////
                originalTask.markComplete();
                let currentSibling = originalTask;
                while (true) {
                    let nextThingAlert = new Alert("Is there anything that has to happen next?", currentSibling.name);
                    nextThingAlert.addOption("Yep!");
                    nextThingAlert.addOption("No, we're all done");
                    let nextThingAnswer = await nextThingAlert.show();
                    if (nextThingAnswer == 1) {
                        break;
                    }
                    let nextSiblingForm = new Form();
                    nextSiblingForm.addField(new Form.Field.String("name", "What's Next?"));
                    nextSiblingForm.addField(new Form.Field.String("note", "Notes"));
                    await nextSiblingForm.show(`What's the next thing that needs to happen after "${currentSibling.name}"?`, "Save");
                    var values = nextSiblingForm.values;
                    currentSibling = new Task(values.name, currentSibling.after);
                    currentSibling.note = values.note;
                    currentSibling.addTags(originalTask.tags);
                }
            }
            else if (isDoneAnswer == 1) {
                /////////////////////////////
                // No, it's not quite done //
                /////////////////////////////
                let nextThingForm = new Form();
                nextThingForm.addField(new Form.Field.String("name", "What's Next?"));
                nextThingForm.addField(new Form.Field.String("note", "Notes"));
                await nextThingForm.show(`What's the next thing that needs to happen to finish "${originalTask.name}"?`, "Save");
                var values = nextThingForm.values;
                let currentSibling = new Task(values.name, originalTask.beginning);
                currentSibling.note = values.note;
                currentSibling.addTags(originalTask.tags);
                while (true) {
                    let nextThingAlert = new Alert("Is there anything that'd have to happen after this is done?", currentSibling.name);
                    nextThingAlert.addOption("Yep!");
                    nextThingAlert.addOption("No, not for now");
                    let nextThingAnswer = await nextThingAlert.show();
                    if (nextThingAnswer == 1) {
                        break;
                    }
                    let nextSiblingForm = new Form();
                    nextSiblingForm.addField(new Form.Field.String("name", "What's Next?"));
                    nextSiblingForm.addField(new Form.Field.String("note", "Notes"));
                    await nextSiblingForm.show(`What's the next thing that needs to happen after "${currentSibling.name}"?`, "Save");
                    values = nextSiblingForm.values;
                    currentSibling = new Task(values.name, currentSibling.after);
                    currentSibling.note = values.note;
                    currentSibling.addTags(originalTask.tags);
                }
            }
            else if (isDoneAnswer == 2) {
                ///////////////////////////////////////
                // Whoops, didn't mean to click that //
                ///////////////////////////////////////
                return;
            }
            else {
                /////////////////////////////////////////
                // We forgot how many answers we added //
                /////////////////////////////////////////
                new Alert("Whoops!", `I got a value of '${isDoneAnswer}' from that alert, but I'm not sure what that means. This is a plugin bug!`);
                return;
            }
        }
        catch (err) {
            console.error(err);
        }
    });
    action.validate = function (selection, sender) {
        return selection.tasks.length === 1 && !selection.tasks[0].hasChildren;
    };
    return action;
})();

(() => {
    let creds = new Credentials();

    var action = new PlugIn.Action(async () => {
        try {
            let req = URL.FetchRequest.fromString("https://api.linear.app/graphql");

            /////////////////////////////////////
            // Step 1: make sure we have creds //
            /////////////////////////////////////
            // creds.remove(req.url.host);
            let stored = creds.read(req.url.host);

            let key = null;
            if (stored === null || app.optionKeyDown) {
               let credsForm = new Form();
               credsForm.addField(new Form.Field.Password("key", "API Key"));

               await credsForm.show("Please create a personal API key in the Linear settings and paste it here\n(hold option while activating this workflow in the future to reset this)", "Save Key");
               key = credsForm.values.key;

               creds.write(req.url.host, "-", key);
            } else {
               key = stored.password;
            }

            ///////////////////////////
            // Step 2: get the tasks //
            ///////////////////////////
            req.method = "POST";
            req.bodyString = '{"query":"{ viewer { assignedIssues(filter: {state: {type: {nin: [\\"completed\\",\\"canceled\\"]}}}) { nodes { identifier title url team { name } project { name } } } } }"}';
            req.headers = {
              "Content-Type": "application/json",
              "Authorization": key,
            };

            let resp = await (req.fetch().catch((err) => {
              console.error("Problem fetching tasks:", err);
              let alert = new Alert("Problem fetching from Linear", err);
              alert.show();
              throw err;
            }));

            let body = JSON.parse(resp.bodyString);

            //////////////////////////////////
            // Step 3: make the tasks in OF //
            //////////////////////////////////
            let toFocus = [];
            for (let linearTask of body.data.viewer.assignedIssues.nodes) {
              let teamsTag = flattenedTags.byName("teams") || new Tag("teams");
              let teamTag = teamsTag.tagNamed(linearTask.team.name) || new Tag(linearTask.team.name, teamsTag);

              let projectName = `${linearTask.team.name} Non-Project Tasks`;
              if (linearTask.project !== null) {
                projectName = linearTask.project.name;
              }

              let project = flattenedProjects.byName(projectName) || new Project(projectName);
              project.addTag(teamTag);
              project.containsSingletonActions = true;
              toFocus.push(project);

              let taskName = `${linearTask.identifier}: ${linearTask.title}`;
              let task = project.taskNamed(taskName) || new Task(taskName, project);
              task.addTag(teamTag);
              if (task.note.indexOf(linearTask.url) === -1) {
                if (task.note !== "") {
                  task.appendStringToNote(`\n\n${linearTask.url}`);
                } else {
                  task.appendStringToNote(linearTask.url)
                }
              }
            }

            if (app.platformName === "macOS") {
              document.windows[0].perspective = Perspective.BuiltIn.Projects;
              document.windows[0].focus = toFocus;
            }
        } catch (err) {
          console.error(err);
          throw err;
        }
    });

    return action;
})();

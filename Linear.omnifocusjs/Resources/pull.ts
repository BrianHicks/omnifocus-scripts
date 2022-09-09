(() => {
    let creds = new Credentials();

    var action = new PlugIn.Action(async () => {
        try {
            let req = URL.FetchRequest.fromString("https://api.linear.app/graphql");
            if (req === null || req.url === null || req.url.host === null) {
                throw "could not parse the URL for Linear's API"
            }

            /////////////////////////////////////
            // Step 1: make sure we have creds //
            /////////////////////////////////////
            let stored = creds.read(req.url.host);

            let key = null;
            if (stored === null || app.optionKeyDown) {
               let credsForm = new Form();
               credsForm.addField(new Form.Field.Password("key", "API Key"));

               await credsForm.show("Please create a personal API key in the Linear settings and paste it here\n(hold option while activating this workflow in the future to reset this)", "Save Key");
               key = (credsForm.values as { key: string }).key;

               creds.write(req.url.host, "-", key);
            } else {
               key = stored.password;
            }

            ///////////////////////////
            // Step 2: get the tasks //
            ///////////////////////////
            req.method = "POST";
            req.bodyString = '{"query":"{ viewer { assignedIssues(filter: {state: {type: {nin: [\\"completed\\",\\"canceled\\"]}}}) { nodes { identifier title url team { name } project { name url } } } } }"}';
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

            if (resp.bodyString === null) {
                throw "body string was null. Did the request succeed?"
            }

            let body = JSON.parse(resp.bodyString);

            //////////////////////////////////
            // Step 3: make the tasks in OF //
            //////////////////////////////////
            let toFocus: Array<Project> = [];
            for (let linearTask of body.data.viewer.assignedIssues.nodes) {
              let teamsTag = flattenedTags.byName("teams") || new Tag("teams");
              let teamTag = teamsTag.tagNamed(linearTask.team.name) || new Tag(linearTask.team.name, teamsTag);

              let linearTag = flattenedTags.byName("from Linear") || new Tag("from Linear");

              let projectName = `${linearTask.team.name} Non-Project Tasks`;
              if (linearTask.project !== null) {
                projectName = linearTask.project.name;
              }

              let project = flattenedProjects.byName(projectName) || new Project(projectName);
              project.addTag(teamTag);
              project.addTag(linearTag);
              project.containsSingletonActions = true;
              toFocus.push(project);
              if (linearTask.project && project.note.indexOf(linearTask.project.url) === -1) {
                if (project.note !== "") {
                  project.appendStringToNote(`\n\n${linearTask.project.url}`);
                } else {
                  project.appendStringToNote(linearTask.project.url)
                }
              }

              let taskName = `${linearTask.identifier}: ${linearTask.title}`;
              let task = project.taskNamed(taskName) || new Task(taskName, project);
              task.addTag(teamTag);
              task.addTag(linearTag);
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
              document.windows[0].focus = toFocus as SectionArray;
            }
        } catch (err) {
          console.error(err);
          throw err;
        }
    });

    return action;
})();

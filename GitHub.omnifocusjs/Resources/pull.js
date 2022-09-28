"use strict";
(() => {
    let creds = new Credentials();
    var action = new PlugIn.Action(async () => {
        try {
            let req = URL.FetchRequest.fromString("https://api.github.com/graphql");
            if (req === null || req.url === null || req.url.host === null) {
                throw "could not parse the URL for GitHub's GraphQL API";
            }
            /////////////////////////////////////
            // Step 1: make sure we have creds //
            /////////////////////////////////////
            let stored = creds.read(req.url.host);
            let login = null;
            let key = null;
            if (stored === null || app.optionKeyDown) {
                let credsForm = new Form();
                credsForm.addField(new Form.Field.String("login", "Login"));
                credsForm.addField(new Form.Field.Password("key", "API Key"));
                await credsForm.show("Let's set up: we need your GitHub username and an API key with the\n`repo` permission to pull issues from your assigned repos.\n\nCreate this at https://github.com/settings/tokens\n\nYou can get back here in the future to rotate tokens by holding\noption while activating the workflow.", "Save Key");
                login = credsForm.values.login;
                key = credsForm.values.key;
                creds.write(req.url.host, login, key);
            }
            else {
                login = stored.user;
                key = stored.password;
            }
            ////////////////////////////
            // Step 2: get the issues //
            ////////////////////////////
            req.method = "POST";
            req.bodyString = `{"query":"{ search(type: ISSUE, query: \\"is:issue assignee:${login} state:open\\", last: 100) { nodes { ... on Issue { number title body url repository { name owner { login } } } } } }"}`;
            req.headers = {
                "Content-Type": "application/json",
                "Authorization": `bearer ${key}`,
            };
            let resp = await (req.fetch().catch((err) => {
                console.error("Problem fetching issues:", err);
                let alert = new Alert("Problem fetching from GitHub", err);
                alert.show();
                throw err;
            }));
            if (resp.bodyString === null) {
                throw "body string was null. Did the request succeed?";
            }
            let body = JSON.parse(resp.bodyString);
            let toFocus = [];
            for (let issue of body.data.search.nodes) {
                let gitHubTag = flattenedTags.byName("from GitHub") || new Tag("from GitHub");
                let orgTag = gitHubTag.tagNamed(issue.repository.owner.login) || new Tag(issue.repository.owner.login, gitHubTag);
                let repoTag = orgTag.tagNamed(issue.repository.name) || new Tag(issue.repository.name, orgTag);
                let repo = `${issue.repository.owner.login}/${issue.repository.name}`;
                let projectName = `${repo}#${issue.number}: ${issue.title}`;
                let project = flattenedProjects.byName(projectName) || new Project(projectName);
                project.addTag(repoTag);
                project.note = `${issue.url}\n\n---\n\n${issue.body}`;
                toFocus.push(project);
                if (project.tasks.length === 0) {
                    new Task(`what needs to be done for ${repo}#${issue.number}?`, project);
                }
            }
            if (app.platformName === "macOS") {
                document.windows[0].perspective = Perspective.BuiltIn.Projects;
                document.windows[0].focus = toFocus;
            }
        }
        catch (err) {
            console.error(err);
            throw err;
        }
    });
    return action;
})();

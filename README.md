# OmniFocus Scripts

## Linear

Pull tasks from Linear into your OmniFocus database.
When this script runs, it will:

- Create a tag named "teams" and a tag for each team you're pulling work from under it.
- Create a singleton-item project named the same thing as the project the task is from.
- Create a task named "TEAM-123 Name of task" with the URL in the note.

It will also make sure those things exist for each project each time it runs.
It's fine if you move the "teams" tag or the projects; the script does not expect them to be at the top level.

The first time you run the script, it will prompt you for a personal API token.
You can create one of these in your Linear settings (hit <kbd>g</kbd>-<kbd>s</kbd> and look for "API" on the left-hand sidebar.)

The token is stored in OmniFocus' credentials database that they make available to plugins instead of being stored in plain text somewhere, so it should be reasonably secure.
That said, if you want to rotate or remove the key, hold <kbd>⌥</kbd> when invoking the script, and you'll be prompted for a new key.

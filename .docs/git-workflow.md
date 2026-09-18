## Git workflow

* `main` - is a production and is displayed on the application;
* `develop` - is a branch where new functionality is developed.

Changes can only be injected into `main` from the `develop` branch after the functionality has been tested and is stable in
operation. You can create your own branches only from `develop` and inject into it after testing. A separate
branch named `feature/task/{task number}` is created for each task.

All commits must be of the same form `#{task number} something about my changes`.

Example commit:

```text
#34 fixed open map button
```

### Rules for creating hotfixes

A hotfix is a commit to `main` or `develop` with the number of the task for which it is created.

### Rules of merger

* `develop` -> `main` (`Merge`);
* `feature/task/{task number}` -> `develop` (`Squash`);
* Hotfix -> `develop` or `main` (`Merge`).

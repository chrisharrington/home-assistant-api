This is an API that's exposed to Home Assistant to provide an easier environment into which complex sensor information can be
gathered and stored.

## General Code Guidelines

-   Strict typing; prefer unknown over any; readonly/immutable state.
-   React: function components/hooks; centralized HTTP clients; error boundaries.
-   Dates as ISO-8601 UTC; align DTOs with server contracts.
-   Include instructions from the adjacent README.md file if it exists.
-   Use `bun`.
-   Use spaces over tabs.
-   Use four spaces for a tab.
-   After making any changes to the client code, ALWAYS perform type-checking by running `tsc --noEmit`.

## Testing

-   Use the `bun` test runner.
-   Never mock first-party components unless specifically asked to do so.
-   Never examine internal state to during the verification stage of a test.

## Comments

-   Use proper punctuation, including periods at the end.
-   For inline comments within functions, classes or components:
    -   Group logical code pieces together and provide one inline comment per group.
    -   Separate groups by newlines.
    -   Use // comment style.
    -   Keep comments concise and to the point.
    -   Use proper punctuation, including periods at the end.
-   For header comments:
    -   Use /\*\* \*/.
    -   Give a general summary.
    -   Provide documentation for parameters and return values.
    -   Use `@param paramName - Description` instead of `@param {Type} paramName - Description`.
    -   Use `@returns Description` instead of `@returns {Type} Description`.
-   When updating code, ensure that all related comments and documentation are also updated.

### Component File Structure

Components should be organized into separate files for maintainability and clarity. This structure should **always** be used.

#### Required Files:

-   **index.ts**: Contains the main class or library function.
-   **index.test.ts**: Contains tests for the class defined within the adjacent `index.ts` file.

### Component Organization Rules

-   Favour a higher number of small components instead of a single large component.
-   If a component is too large, split it up into separate components. Those separate components should exist within a sub folder following the file structure detailed above.
-   A component over 200 lines is too large and should be split up.
-   Boolean state variables should be defined as such: `[isBusy, setBusy] = useState<boolean>(false)`.
-   When defining state variables via `useState`, ensure they are typed correctly.
-   When creating code with consecutive variables, always use a single `const` with comma separated variable declarations like this:

    const first = 1,
    second = 2,
    third = 3;
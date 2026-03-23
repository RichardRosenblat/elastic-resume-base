# Frontend code review

## Env vars

at the config.yaml the VITE_FIREBASE_PROJECT_ID variable could be replaced by the shared FIREBASE_PROJECT_ID variable, since it is used in both frontend and backend. This would reduce redundancy and make it easier to manage the project ID in one place.


## Theming
the theme.json file could be used as example, and the actual theme file could be renamed to theme.local.json and added to .gitignore, so that each developer and client can have their own local theme settings without affecting others. 

## Vite environment loading

Vite does not use the shared tool for loading environment variables, so it reads them directly from the config.yaml file during development. The Toolbox collection of tools contains a tool for loading environment variables from the config.yaml file and should be used by the frontend as well to ensure consistency across the project

## Remove me endpoint
the bff endpoint GET /api/v1/me is causing confusion with /api/v1/users/me and should be removed to avoid ambiguity. The frontend should only use /api/v1/users/me to fetch the user profile, and the /api/v1/me endpoint should be deleted from the backend.
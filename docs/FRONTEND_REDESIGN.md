# Greenfield University Frontend Redesign

## Design direction

The frontend uses the Greenfield Academic visual system: institutional navy, teal action accents, neutral canvas backgrounds, restrained borders and shadows, consistent focus states, and responsive layouts. Existing React, Vite, plain CSS, authentication, and backend API contracts are retained.

## Updated files

- `index.html` — university title, description, and browser theme color.
- `src/main.jsx` — loads the shared Greenfield design stylesheet.
- `src/styles/greenfield.css` — shared design tokens and responsive visual overrides for all three roles.
- `src/services/apiConfig.js` — shared API base URL configuration.
- `src/App.jsx` — Super Admin dashboard, dynamic authenticated identity, removal of fabricated dashboard figures and notification examples, and student-directory pagination.
- `src/StudentPortal.jsx` — university identity, dashboard-first navigation, honest empty states instead of hardcoded academic records, timetable/exam placeholder removal, and API-backed messages/announcements.
- `src/TeacherPortal.jsx` — university identity, role-specific workspace navigation, and an assigned-student directory while retaining existing course, timetable, and attendance API workflows.
- `src/AdminModules.jsx` — shared API configuration; existing module workflows retained.
- `src/RegistrationManagementPage.jsx` — shared API configuration; existing registration workflows retained.
- `src/CourseRequestsPage.jsx` — shared API configuration; existing course-request workflows retained.
- `src/StudentRegistrationPage.jsx` — shared API configuration; existing registration workflow retained.
- `.env.example` — frontend API configuration template.

## API configuration

The default API base URL remains `http://localhost:5000/api`. To use another backend URL, create a frontend `.env` file based on `.env.example` and set `VITE_API_BASE_URL`.

## Run locally

1. Install Node.js 20 or newer.
2. In the project root, run `npm install`.
3. Ensure the backend is running and reachable at the configured API URL.
4. Run `npm run dev`.
5. Open the Vite URL printed in the terminal (normally `http://localhost:5173`).
6. For a production bundle, run `npm run build`; preview it with `npm run preview`.

## Verification status

- All frontend JSX files passed TypeScript compiler parser/transpilation syntax checks.
- Relative import targets and API configuration were reviewed.
- A full Vite production build and live role/API browser tests were not completed in this environment because dependency installation could not retrieve the Vite packages from the npm registry. Run `npm install` and `npm run build` locally before deployment.

## Integration boundaries

The current backend does not expose a verified set of endpoints for every requested idea (for example, student library loans, student events, assignments, and a dedicated dashboard notification feed). These screens must not fabricate records. Existing functional API workflows are preserved; unsupported data is presented as unavailable or empty until a real backend contract is provided.

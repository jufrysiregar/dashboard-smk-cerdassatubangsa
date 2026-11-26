// Public API surface for the standalone demo.
//
// The real axios instance + localStorage mock adapter live in `src/utils/api.js`
// (that is the file every page imports). This module is a thin re-export so the
// documented path `src/services/api.js` also works, and it exposes the demo-only
// helper `resetDemoData()` used by the "Reset Data Demo" button.

export * from '../utils/api';
export { default } from '../utils/api';

export { resetDemoData, ensureSeeded } from '../mocks/demoSeeder';

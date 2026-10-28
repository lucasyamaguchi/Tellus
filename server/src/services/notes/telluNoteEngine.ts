// Backward-compatibility bridge: all note engine features are standardized on TellusNoteEngine
export * from './tellusNoteEngine.js';
export {
  TellusNoteEngine as default,
  TellusNoteEngine,
  TelluNoteEngine,
  FrankNoteEngine,
  NotesEngine
} from './tellusNoteEngine.js';

import type { Diagnostic, Outcome } from './model.js';
export const diagnostic = (code: string, path: string, message: string, severity: Diagnostic['severity'] = 'error'): Diagnostic => ({ code, path, message, severity });
export const failure = <T>(code: string, path: string, message: string): Outcome<T> => ({ value: null, diagnostics: [diagnostic(code, path, message)] });

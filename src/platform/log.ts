// One JSON line per event. Never log emails, raw receipt text, images or secrets (SPEC §11, G12).
export function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ t: new Date().toISOString(), event, ...fields }));
}

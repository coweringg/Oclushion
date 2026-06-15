import type { EntitlementsService } from "../billing/entitlements.service";

export function validateVoiceDictationAccess(entitlementsService: EntitlementsService): void {
  entitlementsService.assertAccess("hasVoiceDictation", "Voice dictation");
}

export function validateGodModeAccess(entitlementsService: EntitlementsService): void {
  entitlementsService.assertAccess("hasGodMode", "God Mode");
}

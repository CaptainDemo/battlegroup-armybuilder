import { t } from './index';

/** Keep engine identifiers in diagnostics, with readable resource names in UI. */
export function issueMessage(message: string): string {
  return message
    .replaceAll('army-support-choice', t('editor.armySupportChoice'))
    .replaceAll('platoon-support-slots', t('editor.platoonSupportSlots'));
}

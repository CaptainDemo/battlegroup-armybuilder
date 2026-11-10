import type { SectionAllowance } from '../features/roster-editor/sectionAllowances';
import { t } from '../i18n';

export function SectionCount({ allowance }: { allowance: SectionAllowance }) {
  return (
    <span className="section-count">
      <span>{allowance.selected} {t('editor.selectedCount')}</span>
      {allowance.limits.length ? allowance.limits.map((limit, index) => (
        <span className={limit.used > limit.capacity ? 'section-count--over' : ''} key={index}>
          {limit.used} / {limit.capacity} {t('editor.choicesCount')}
          {limit.shared && <span className="section-shared" title={t('editor.sharedChoicesNote')}> · {t('editor.sharedChoices')}</span>}
        </span>
      )) : <span title={t('editor.noSectionLimit')}>{t('editor.limit')} —</span>}
    </span>
  );
}

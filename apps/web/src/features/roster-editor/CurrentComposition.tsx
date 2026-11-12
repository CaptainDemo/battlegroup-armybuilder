import type { EvaluatedCompositionNode } from '@battlegroup/core';
import type { AppCatalogRelease, RulesetRegistration } from '../../rulesets/types';
import type { SpecialRuleView } from '../../rulesets/specialRules';

interface CompositionProps {
  node: EvaluatedCompositionNode;
  release: AppCatalogRelease;
  runtime: RulesetRegistration;
  rules: ReadonlyMap<string, readonly SpecialRuleView[]>;
  path: readonly string[];
  rootLabel: string;
}

export function CurrentComposition(props: CompositionProps) {
  return <ul className="composition-tree"><CompositionMember {...props} /></ul>;
}

function CompositionMember({ node, release, runtime, rules, path, rootLabel }: CompositionProps) {
  if (node.quantity <= 0) return null;
  const profile = release.catalog.profiles.find(item => item.localId === node.profileLocalId);
  const label = (path.length ? runtime.memberPresentation?.(node, release.catalog)?.label : undefined)
    ?? profile?.name ?? (path.length ? node.nodeId.replaceAll('-', ' ') : rootLabel);
  const training = node.training?.state === 'known'
    ? runtime.trainingLabels[node.training.value] ?? node.training.value : null;
  const tags = rules.get(JSON.stringify(path));
  const children = node.children?.filter(child => child.quantity > 0);
  return <li data-composition-path={JSON.stringify(path)}>
    <div className="composition-line">
      <span>{node.quantity} × {label}</span>
      {training && <span className="muted"> · {training}</span>}
      {tags?.map(rule => <span className="composition-rule" key={rule.key}>{rule.name}</span>)}
    </div>
    {children?.length ? <ul>
      {children.map(child => <CompositionMember
        key={child.nodeId}
        node={child}
        release={release}
        runtime={runtime}
        rules={rules}
        path={[...path, child.nodeId]}
        rootLabel={rootLabel}
      />)}
    </ul> : null}
  </li>;
}

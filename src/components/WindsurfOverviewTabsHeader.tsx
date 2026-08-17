import { PlatformOverviewTabsHeader, PlatformOverviewTab } from './platform/PlatformOverviewTabsHeader';

export type WindsurfTab = PlatformOverviewTab;

interface WindsurfOverviewTabsHeaderProps {
  active: WindsurfTab;
  onTabChange?: (tab: WindsurfTab) => void;
}

export function WindsurfOverviewTabsHeader({
  active,
  onTabChange,
}: WindsurfOverviewTabsHeaderProps) {
  return (
    <PlatformOverviewTabsHeader platform="windsurf" active={active} onTabChange={onTabChange} />
  );
}

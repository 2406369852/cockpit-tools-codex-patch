import { PlatformOverviewTabsHeader, PlatformOverviewTab } from './platform/PlatformOverviewTabsHeader';

export type KiroTab = PlatformOverviewTab;

interface KiroOverviewTabsHeaderProps {
  active: KiroTab;
  onTabChange?: (tab: KiroTab) => void;
}

export function KiroOverviewTabsHeader({
  active,
  onTabChange,
}: KiroOverviewTabsHeaderProps) {
  return (
    <PlatformOverviewTabsHeader platform="kiro" active={active} onTabChange={onTabChange} />
  );
}

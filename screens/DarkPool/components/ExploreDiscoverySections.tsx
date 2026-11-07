import i18n from '../../../lib/i18n';
import React, { useMemo } from 'react';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import {
  filterExplorePeopleByKind,
  type ExploreKindFilter,
} from '../utils/exploreGrid';
import { ExploreRailSection } from './ExploreRailSection';
import { ExploreTwoColSection } from './ExploreTwoColSection';

interface Props {
  mostFollowed: ExplorePerson[];
  fundBooks: ExplorePerson[];
  recentlyActive: ExplorePerson[];
  newProfiles: ExplorePerson[];
  mostActive: ExplorePerson[];
  excessLeaders: ExplorePerson[];
  politicians: ExplorePerson[];
  executives: ExplorePerson[];
  funds: ExplorePerson[];
  /** חברות ציבוריות שמגישות 13F (NVIDIA, Alphabet...) */
  companies: ExplorePerson[];
  kindFilter: ExploreKindFilter | null;
  onKindChange: (kind: ExploreKindFilter | null) => void;
  kindCounts: Partial<Record<ExploreKindFilter, number>>;
  onPersonPress: (person: ExplorePerson) => void;
  /** איזה מדף עוד מחכה לנתונים (שלד במקומו) */
  loading?: { followed: boolean; excess: boolean; recent: boolean; extras: boolean; grid: boolean };
}

/** מדפי הגילוי לפי קטגוריות — בלי גריד «פרופילים» ששופך את כולם. */
export function ExploreDiscoverySections({
  mostFollowed,
  fundBooks,
  recentlyActive,
  newProfiles,
  mostActive,
  excessLeaders,
  politicians,
  executives,
  funds,
  companies,
  kindFilter,
  onKindChange,
  kindCounts,
  onPersonPress,
  loading,
}: Props) {
  const followed = useMemo(
    () => filterExplorePeopleByKind(mostFollowed, kindFilter),
    [mostFollowed, kindFilter]
  );
  const books = useMemo(
    () => filterExplorePeopleByKind(fundBooks, kindFilter),
    [fundBooks, kindFilter]
  );
  const recent = useMemo(
    () => filterExplorePeopleByKind(recentlyActive, kindFilter),
    [recentlyActive, kindFilter]
  );
  const fresh = useMemo(
    () => filterExplorePeopleByKind(newProfiles, kindFilter),
    [newProfiles, kindFilter]
  );
  const active = useMemo(
    () => filterExplorePeopleByKind(mostActive, kindFilter),
    [mostActive, kindFilter]
  );
  const excess = useMemo(
    () => filterExplorePeopleByKind(excessLeaders, kindFilter),
    [excessLeaders, kindFilter]
  );
  const congress = useMemo(
    () => filterExplorePeopleByKind(politicians, kindFilter),
    [politicians, kindFilter]
  );
  const insiders = useMemo(
    () => filterExplorePeopleByKind(executives, kindFilter),
    [executives, kindFilter]
  );
  const fundShelf = useMemo(
    () => filterExplorePeopleByKind(funds, kindFilter),
    [funds, kindFilter]
  );
  const companyShelf = useMemo(
    () => filterExplorePeopleByKind(companies, kindFilter),
    [companies, kindFilter]
  );

  return (
    <>
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s1')}
        people={followed}
        loading={loading?.followed}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s2')}
        people={fundShelf}
        loading={loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s3')}
        people={companyShelf}
        loading={loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s4')}
        people={congress}
        loading={loading?.grid}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s5')}
        people={insiders}
        loading={loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreRailSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s6')}
        people={excess}
        loading={loading?.excess}
        showMetric
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s7')}
        people={books}
        loading={loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s8')}
        people={recent}
        loading={loading?.recent}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s9')}
        people={fresh}
        loading={loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreRailSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s10')}
        people={active}
        loading={loading?.extras}
        onPersonPress={onPersonPress}
      />
    </>
  );
}

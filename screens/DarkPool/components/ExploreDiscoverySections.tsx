import React, { useMemo } from 'react';
import type { ExplorePerson } from '../../../services/darkpool/uwExploreService';
import {
  filterExplorePeopleByKind,
  type ExploreKindFilter,
} from '../utils/exploreGrid';
import { ExploreKindFilterBar } from './ExploreKindFilter';
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
      <ExploreKindFilterBar
        value={kindFilter}
        onChange={onKindChange}
        counts={kindCounts}
      />
      <ExploreTwoColSection
        title="הנצפים ביותר"
        people={followed}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="קרנות גידור מובילות"
        people={fundShelf}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="חברות ציבוריות"
        people={companyShelf}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="פוליטיקאים"
        people={congress}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="מנכ״לים"
        people={insiders}
        onPersonPress={onPersonPress}
      />
      <ExploreRailSection
        title="עודף תשואה מול S&P"
        people={excess}
        showMetric
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="קרנות הגידור המובילות"
        people={books}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="פעילים לאחרונה"
        people={recent}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="חדשים אצלנו"
        people={fresh}
        onPersonPress={onPersonPress}
      />
      <ExploreRailSection
        title="הפעילים ביותר"
        people={active}
        onPersonPress={onPersonPress}
      />
    </>
  );
}

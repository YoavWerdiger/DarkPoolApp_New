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
  hasFollowCounts: boolean;
  fundBooks: ExplorePerson[];
  recentlyActive: ExplorePerson[];
  newProfiles: ExplorePerson[];
  mostActive: ExplorePerson[];
  excessLeaders: ExplorePerson[];
  politicians: ExplorePerson[];
  executives: ExplorePerson[];
  funds: ExplorePerson[];
  kindFilter: ExploreKindFilter | null;
  onKindChange: (kind: ExploreKindFilter | null) => void;
  kindCounts: Partial<Record<ExploreKindFilter, number>>;
  onPersonPress: (person: ExplorePerson) => void;
}

/** מדפי הגילוי לפי קטגוריות — בלי גריד «פרופילים» ששופך את כולם. */
export function ExploreDiscoverySections({
  mostFollowed,
  hasFollowCounts,
  fundBooks,
  recentlyActive,
  newProfiles,
  mostActive,
  excessLeaders,
  politicians,
  executives,
  funds,
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

  return (
    <>
      <ExploreKindFilterBar
        value={kindFilter}
        onChange={onKindChange}
        counts={kindCounts}
      />
      <ExploreTwoColSection
        title="הנצפים ביותר"
        subtitle={
          hasFollowCounts ? 'התיקים שעוקבים אחריהם אצלנו' : 'פרופילים מובילים לגילוי'
        }
        people={followed}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="פוזיציות 13F הגדולות"
        subtitle="שווי פוזיציות long מדווחות · לא שווי נטו ולא תיק קונגרס"
        people={books}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="פעילים לאחרונה"
        subtitle="דיווח אחרון אמיתי · בלי דירוג תשואה"
        people={recent}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="חדשים אצלנו"
        subtitle="נוספו לרשימת הגילוי"
        people={fresh}
        onPersonPress={onPersonPress}
      />
      <ExploreRailSection
        title="הפעילים ביותר"
        subtitle="מספר דיווחים אמיתיים — לא Top Performers"
        people={active}
        onPersonPress={onPersonPress}
      />
      <ExploreRailSection
        title="עודף תשואה מול S&P"
        subtitle="חציון ExcessReturn של Quiver מול S&P — לא תשואת תיק"
        people={excess}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="פוליטיקאים"
        subtitle="דיווחי STOCK Act · טווחי סכום בלבד"
        people={congress}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="בכירים"
        subtitle="Form 4 · מניות החברה שמכהנים בה"
        people={insiders}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title="קרנות"
        subtitle="פוזיציות 13F רבעוניות · עם תג התיישנות בפרופיל"
        people={fundShelf}
        onPersonPress={onPersonPress}
      />
    </>
  );
}

import i18n from '../../../lib/i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { runAfterInteractions } from '../../../utils/runAfterInteractions';
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
  // הפריים הראשון: רק שני המדפים העליונים בתוכן מלא (מאות דיוקנים בבת אחת חסמו את המסך — «דיליי»);
  // השאר כשלד עם הכותרת האמיתית, ומתמלאים אחרי סיום אנימציית הכניסה
  const [deferRest, setDeferRest] = useState(true);
  useEffect(() => {
    const task = runAfterInteractions(() => setDeferRest(false), 400);
    return () => task.cancel();
  }, []);
  const later = (people: ExplorePerson[]) => (deferRest ? [] : people);

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
      {/* QA 11.3: חברות ציבוריות מיד אחרי «הנצפים ביותר» */}
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s3')}
        people={companyShelf}
        loading={loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s2')}
        people={later(fundShelf)}
        loading={deferRest || loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s4')}
        people={later(congress)}
        loading={deferRest || loading?.grid}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s5')}
        people={later(insiders)}
        loading={deferRest || loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreRailSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s6')}
        people={later(excess)}
        loading={deferRest || loading?.excess}
        showMetric
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s7')}
        people={later(books)}
        loading={deferRest || loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s8')}
        people={later(recent)}
        loading={deferRest || loading?.recent}
        onPersonPress={onPersonPress}
      />
      <ExploreTwoColSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s9')}
        people={later(fresh)}
        loading={deferRest || loading?.extras}
        onPersonPress={onPersonPress}
      />
      <ExploreRailSection
        title={i18n.t('auto.screens__DarkPool__components__ExploreDiscoverySections.s10')}
        people={later(active)}
        loading={deferRest || loading?.extras}
        onPersonPress={onPersonPress}
      />
    </>
  );
}

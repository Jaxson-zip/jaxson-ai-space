import React from 'react'
import { getHydratedPortfolioData } from '@/features/portfolio/data'
import { HomeView } from '@/components/public-site/home-view'
import {
  profile as fallbackProfile,
  experiences as fallbackExperiences,
  projects as fallbackProjects,
  skillGroups as fallbackSkillGroups,
  awards as fallbackAwards,
} from '@/features/portfolio/content'

export const dynamic = 'force-dynamic'

export default async function Page() {
  let data
  try {
    data = await getHydratedPortfolioData()
  } catch (err) {
    console.error('[Page Render Error]:', err)
    data = {
      profile: fallbackProfile,
      projects: fallbackProjects.filter((p) => p.sourceVisibility === 'public'),
      experiences: fallbackExperiences,
      skillGroups: fallbackSkillGroups,
      awards: fallbackAwards,
      isLiveDb: false,
    }
  }

  return (
    <HomeView
      profile={data.profile}
      projects={data.projects}
      experiences={data.experiences}
      skillGroups={data.skillGroups}
      awards={data.awards}
      isLiveDb={data.isLiveDb}
    />
  )
}

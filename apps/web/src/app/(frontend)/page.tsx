import React from 'react'
import { getHydratedPortfolioData } from '@/features/portfolio/data'
import { HomeView } from '@/components/public-site/home-view'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await getHydratedPortfolioData()

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

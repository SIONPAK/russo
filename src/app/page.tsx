import { Suspense } from 'react'
import { HomePage } from "@/page-components/home/home-page"

function HomePageWithSuspense() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePage />
    </Suspense>
  )
}

export default function Home() {
  return <HomePageWithSuspense />
}

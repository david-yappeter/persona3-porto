import { DetailChips, DetailHeading, DetailSection } from '../../components/ListDetailPage'
import { MenuBackground } from '../../components/MenuBackground'
import { PROFILE } from '../../data/profile'
import '../../components/ListDetailPage/ListDetailPage.css'
import './About.css'

const OCEAN_BG = `${import.meta.env.BASE_URL}assets/persona_3_menu_bg_ocean_seamless.mp4`

/** ABOUT: a P3R status screen — name plate, years as the level, the CV
    summary, and the skills on the white band */
export const About = () => (
  <>
    <MenuBackground videoSrc={OCEAN_BG} />
    <div className="list-detail-band" aria-hidden="true" />
    <div className="list-detail-title" aria-hidden="true">
      ABOUT
    </div>

    <div className="about-status">
      <div className="about-plate">
        <span className="about-plate-tag">Leader</span>
        <h1>{PROFILE.name}</h1>
        <p>{PROFILE.role}</p>
      </div>
      <div className="about-level">
        <span className="about-level-label">Lv</span>
        <span className="about-level-value">{PROFILE.years}</span>
        <span className="about-level-unit">years building backends</span>
      </div>
      <p className="about-location">{PROFILE.location}</p>
      <p className="about-summary">{PROFILE.summary}</p>
    </div>

    <div className="list-detail-panel">
      <DetailHeading title="Skills" sub="From the CV" />
      {PROFILE.skills.map((group) => (
        <DetailSection key={group.label} label={group.label}>
          <DetailChips items={group.items} />
        </DetailSection>
      ))}
    </div>
  </>
)

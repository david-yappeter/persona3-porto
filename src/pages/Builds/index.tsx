import { DetailChips, DetailHeading, DetailLinks, DetailSection, ListDetailPage, type ListEntry } from '../../components/ListDetailPage'
import { PROJECTS } from '../../data/profile'

const ENTRIES: ListEntry[] = PROJECTS.map((p) => ({
  key: p.title,
  imageSrc: p.imageSrc,
  title: p.title,
  subtitle: p.summary,
  aside: p.stack.slice(0, 2).join(' · '),
  tag: p.tag,
  url: p.links[0]?.url,
  detail: (
    <>
      <DetailHeading title={p.title} sub={p.summary} />
      <DetailSection label="Stack">
        <DetailChips items={p.stack} />
      </DetailSection>
      <DetailSection label="Highlights">
        <ul className="detail-lines">
          {p.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        {p.note && <p className="detail-note">{p.note}</p>}
      </DetailSection>
      <DetailSection label="Links">
        <DetailLinks links={p.links} />
      </DetailSection>
    </>
  ),
}))

/** BUILD: the CV's notable projects, the list in a round window onto the
    video with "PROJECTS" round it, like the system menu */
export const Builds = () => <ListDetailPage title="BUILD" ring="PROJECTS" entries={ENTRIES} />

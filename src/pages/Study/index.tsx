import { DetailHeading, DetailLinks, DetailSection, ListDetailPage, type ListEntry } from '../../components/ListDetailPage'
import { STUDIES } from '../../data/profile'

const ENTRIES: ListEntry[] = STUDIES.map((s) => ({
  key: s.school,
  imageSrc: s.imageSrc,
  title: s.school,
  subtitle: s.program,
  aside: s.period,
  tag: s.tag,
  url: s.links[0]?.url,
  detail: (
    <>
      <DetailHeading title={s.school} sub={`${s.program} · ${s.period}`} />
      <DetailSection label="Details">
        <dl className="detail-facts">
          {s.facts.map((f) => (
            <div key={f.label} style={{ display: 'contents' }}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </DetailSection>
      <DetailSection label="Highlights">
        <ul className="detail-lines">
          {s.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </DetailSection>
      {s.links.length > 0 && (
        <DetailSection label="Links">
          <DetailLinks links={s.links} />
        </DetailSection>
      )}
    </>
  ),
}))

/** STUDY: the CV's education */
export const Study = () => <ListDetailPage title="STUDY" entries={ENTRIES} />

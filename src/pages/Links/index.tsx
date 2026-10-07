import { DetailHeading, DetailLinks, DetailSection, ListDetailPage, type ListEntry } from '../../components/ListDetailPage'
import { CONTACTS } from '../../data/profile'

const ENTRIES: ListEntry[] = CONTACTS.map((c) => ({
  key: c.title,
  imageSrc: c.imageSrc,
  title: c.title,
  subtitle: c.handle,
  aside: c.url.startsWith('mailto:') ? 'Write' : 'Open',
  tag: c.tag,
  url: c.url,
  detail: (
    <>
      <DetailHeading title={c.title} sub={c.handle} />
      <DetailSection label="About">
        <p>{c.blurb}</p>
      </DetailSection>
      <DetailSection label="Go">
        <DetailLinks links={[{ label: c.url.startsWith('mailto:') ? 'Send an email' : `Open ${c.title}`, url: c.url }]} />
      </DetailSection>
    </>
  ),
}))

/** LINKS: where to find / reach me, "CONTACTS" on the band; a click (or
    Enter) opens the link */
export const Links = () => <ListDetailPage title="CONTACTS" entries={ENTRIES} openOnClick />

/** Re-mounts on every route change, so each page settles in once. Motion is disabled for reduced-motion users in CSS. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}

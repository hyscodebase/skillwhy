/** npm provenance uses the dispatch SHA/ref, so real publication must run at the tag. */
export function checkNpmPublicationEvent(release, { publish = false, ref = process.env.GITHUB_REF,
  sha = process.env.GITHUB_SHA } = {}) {
  if (typeof publish !== "boolean") throw new Error("The publication choice must be boolean.");
  if (publish && (ref !== `refs/tags/${release.tag}` || sha !== release.commit)) {
    throw new Error("Dispatch real npm publication at the selected tag ref so provenance matches its source commit.");
  }
}

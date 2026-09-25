export function IntegrationPending({
  title = "Blog connection pending",
  message = "The blog is installed and ready. Add the BabyLoveGrowth server-side API key to publish connected articles here.",
}: {
  title?: string;
  message?: string;
}) {
  return (
    <section className="inx-blog-status" role="status">
      <span className="inx-blog-status-dot" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
    </section>
  );
}

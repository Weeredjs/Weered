import SubredditBrowser from "../../../components/SubredditBrowser";

export default function SubPage({ params }: { params: { sub: string } }) {
  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900, marginBottom: 8 }}>subreddit</div>
      <SubredditBrowser subreddit={params.sub} />
    </div>
  );
}

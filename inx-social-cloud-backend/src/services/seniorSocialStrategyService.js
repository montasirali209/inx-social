function parsePosts(value) {
  const raw = String(value || '').trim();
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed.posts) ? parsed.posts : null;
  } catch (_) { return null; }
}

function isFirstPost(value) {
  return /\b(?:first|introductory|introduction|welcome|launch)\s+(?:facebook\s+|instagram\s+|social(?:\s+media)?\s+|page\s+)?post\b|\bpost\s+(?:for|on)\s+(?:my|our|the)\s+(?:new|newly\s+created|just\s+created)\s+(?:facebook\s+|social(?:\s+media)?\s+)?page\b/i.test(String(value || ''));
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

function standardsForTask(taskType) {
  const foundation = [
    'SENIOR STRATEGY STANDARD: Work to an expert-calibre organic social and social-search rubric without claiming personal employment history.',
    'Privately verify brand truth, audience intent, competitor gap, search relevance, platform fit, hook clarity, customer benefit, call to action, visual relevance, accessibility, timing evidence and compliance before returning work.',
    'Prefer a clear customer outcome and one memorable idea over feature lists, inflated language or keyword stuffing. Keep competitor intelligence behind the strategy, not in imitative customer-facing copy.',
    'Return the finished recommendation and concise evidence only. Never reveal private chain-of-thought.'
  ];
  if (String(taskType || '').toUpperCase() === 'COPY_GENERATION') foundation.push('Every structured post must contain a useful title, publish-ready caption, accurate alt text, two to five focused hashtags, a service-relevant visual brief and a measurable organic objective.');
  return foundation;
}

function reviewCopyOutput(plan, value, expectedCount = 1) {
  const posts = parsePosts(value);
  if (!posts) return { approved: false, score: 0, issues: ['Return valid JSON with a top-level posts array.'], postCount: 0 };
  const issues = [];
  let penalty = 0;
  const expected = Math.max(1, Number(expectedCount || 1));
  if (posts.length !== expected) { issues.push(`Return exactly ${expected} post${expected === 1 ? '' : 's'}, not ${posts.length}.`); penalty += 25; }
  posts.slice(0, expected).forEach((post, index) => {
    const label = `Post ${index + 1}`;
    const caption = String(post?.caption || '').trim();
    const visual = String(post?.visualBrief || '').trim();
    const hashtags = Array.isArray(post?.hashtags) ? post.hashtags.filter(Boolean) : [];
    if (!String(post?.title || '').trim()) { issues.push(`${label} needs a clear working title.`); penalty += 8; }
    if (!caption) { issues.push(`${label} needs a publish-ready caption.`); penalty += 35; }
    if (!String(post?.altText || '').trim()) { issues.push(`${label} needs accurate accessibility text.`); penalty += 10; }
    if (!visual) { issues.push(`${label} needs a service-relevant visual brief.`); penalty += 15; }
    if (!String(post?.objective || '').trim()) { issues.push(`${label} needs an organic objective.`); penalty += 8; }
    if (!Array.isArray(post?.hashtags)) { issues.push(`${label} hashtags must be an array.`); penalty += 8; }
    if (hashtags.length > 5) { issues.push(`${label} uses too many hashtags; keep no more than five focused terms.`); penalty += 8; }
    const words = wordCount(caption);
    if (caption && words < 35) { issues.push(`${label} caption is too thin to explain useful customer value.`); penalty += 8; }
    if (words > 220) { issues.push(`${label} caption is too long for this workflow.`); penalty += 6; }
    if (isFirstPost(plan?.prompt) && caption && (words < 70 || words > 140)) { issues.push(`${label} first-post caption should be approximately 70–140 words.`); penalty += 10; }
    if (/\b(?:guaranteed|number\s*one|#1|best\s+in\s+the\s+uk|instant\s+results|always|never\s+fails)\b/i.test(caption)) { issues.push(`${label} contains an absolute or unsupported marketing claim.`); penalty += 15; }
    if (/\b(?:fake\s+dashboard|phone\s+mockup|interface\s+mockup|generic\s+technology|random\s+(?:text|lettering)|generated\s+logo|feature\s+checklist)\b/i.test(visual)) { issues.push(`${label} visual brief requests a prohibited generic or fabricated concept.`); penalty += 18; }
    if (caption && !/\b(?:learn|discover|follow|visit|try|message|tell\s+us|get\s+started|find\s+out|join|explore|see\s+how|ready)\b/i.test(caption)) { issues.push(`${label} needs one natural next step or call to action.`); penalty += 5; }
  });
  const score = Math.max(0, 100 - penalty);
  return { approved: score >= 75 && !issues.some(issue => /valid JSON|publish-ready caption|prohibited/.test(issue)), score, issues: issues.slice(0, 12), postCount: posts.length };
}

function repairInstruction(review) {
  return `The draft did not pass the senior social strategy quality gate (${review.score}/100). Repair every issue and return the complete JSON again: ${review.issues.join(' ')}`.slice(0, 3000);
}

module.exports = { parsePosts, isFirstPost, wordCount, standardsForTask, reviewCopyOutput, repairInstruction };

(() => {
  const $ = id => document.getElementById(id);
  const pick = items => items[Math.floor(Math.random() * items.length)];
  const clean = (value, fallback) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 180) || fallback;
  const slugWords = value => clean(value, '').toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter(Boolean).slice(0, 5);
  const platformStyle = {
    Instagram: { opener: ['Stop scrolling for a second 👀', 'Here’s something worth saving.', 'Quick idea for your next scroll break:'], ending: ['Save this for later.', 'Share this with someone who needs it.', 'Which part would you try first?'] },
    Facebook: { opener: ['A quick thought for our community:', 'Here’s something useful to know today:', 'We’ve been thinking about this a lot lately:'], ending: ['What do you think?', 'Tell us in the comments.', 'Share this with someone who might find it useful.'] },
    LinkedIn: { opener: ['One practical lesson:', 'A useful reminder for anyone working on this:', 'Here’s the part people often overcomplicate:'], ending: ['What has worked for you?', 'I’d be interested to hear a different perspective.', 'Save this for your next planning session.'] },
    'X / Twitter': { opener: ['Quick take:', 'Worth remembering:', 'Simple idea:'], ending: ['Agree or disagree?', 'What would you add?', 'Bookmark this.'] }
  };
  const toneLines = {
    Professional: ['Keep the message clear, useful and easy to act on.', 'The goal is simple: make the next step obvious.', 'Clarity usually outperforms complexity.'],
    Friendly: ['No pressure, just a useful idea you can try.', 'Small changes can make a surprisingly big difference.', 'Keep it simple and make it feel like you.'],
    Bold: ['Most people overthink this. Don’t.', 'The boring version is easy. The memorable version takes a point of view.', 'If you want attention, give people a reason to stop.'],
    Educational: ['Here’s the simple way to think about it.', 'Use this as a quick framework, not a rigid rule.', 'The strongest content usually teaches one clear thing at a time.']
  };

  function buildCaption({ platform, topic, audience, tone, goal }) {
    const style = platformStyle[platform] || platformStyle.Instagram;
    const topicText = clean(topic, 'your next content idea');
    const audienceText = clean(audience, 'your audience');
    const goalText = clean(goal, 'take the next step');
    const bodyOptions = [
      `${topicText} matters because ${audienceText} do not need more noise — they need a clear reason to care. ${pick(toneLines[tone] || toneLines.Friendly)}`,
      `If you are speaking to ${audienceText}, make ${topicText} specific. Show the problem, the useful takeaway and the next action. ${pick(toneLines[tone] || toneLines.Friendly)}`,
      `A better way to talk about ${topicText}: start with the real problem, give one practical takeaway, then make it easy for ${audienceText} to ${goalText}.`
    ];
    const tags = slugWords(topicText).map(word => `#${word.replace(/-/g, '')}`);
    const fallbackTags = ['#socialmedia', '#contentmarketing', '#smallbusiness'];
    const hashtags = [...new Set([...tags, ...fallbackTags])].slice(0, 6).join(' ');
    return `${pick(style.opener)}\n\n${pick(bodyOptions)}\n\n${pick(style.ending)}\n\n${hashtags}`;
  }

  const captionForm = $('captionForm');
  if (captionForm) {
    captionForm.addEventListener('submit', event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(captionForm));
      const output = $('captionResults');
      output.innerHTML = '';
      for (let i = 0; i < 3; i += 1) {
        const article = document.createElement('article');
        article.className = 'caption';
        const label = document.createElement('b');
        label.textContent = `Variation ${i + 1}`;
        article.append(label, document.createTextNode(buildCaption(values)));
        output.append(article);
      }
      $('captionResultWrap').hidden = false;
      $('captionResultWrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('copyCaptions')?.addEventListener('click', async () => {
      const text = [...document.querySelectorAll('.caption')].map((node, i) => `Variation ${i + 1}\n${node.textContent.replace(`Variation ${i + 1}`, '').trim()}`).join('\n\n---\n\n');
      await navigator.clipboard.writeText(text);
      $('copyCaptions').textContent = 'Copied';
    });
  }

  const formats = ['Quick tip', 'Carousel', 'Behind the scenes', 'Short video', 'Myth vs fact', 'Customer story', 'How-to', 'Question post', 'List post', 'Before / after'];
  const pillars = [
    ['Teach', 'Explain one mistake your audience makes and how to fix it.'],
    ['Problem', 'Name a frustrating problem your ideal customer recognises immediately.'],
    ['Proof', 'Show a result, customer example, process improvement or before/after story.'],
    ['Process', 'Take people behind the scenes of how you do the work.'],
    ['Opinion', 'Share a useful point of view that challenges a common assumption.'],
    ['FAQ', 'Answer one question customers repeatedly ask before buying.'],
    ['Story', 'Tell a short story about why the business, product or service exists.'],
    ['Offer', 'Present the offer clearly: who it is for, what it helps with and the next step.']
  ];
  const hooks = [
    value => `3 things people misunderstand about ${value}`,
    value => `Before you spend more time on ${value}, read this`,
    value => `The simple way we approach ${value}`,
    value => `A mistake we keep seeing with ${value}`,
    value => `What we wish more people knew about ${value}`,
    value => `If ${value} feels complicated, start here`,
    value => `One small change that can improve ${value}`,
    value => `The question to ask before you choose ${value}`
  ];

  const plannerForm = $('plannerForm');
  if (plannerForm) {
    plannerForm.addEventListener('submit', event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(plannerForm));
      const business = clean(values.business, 'your business');
      const audience = clean(values.audience, 'your customers');
      const goal = clean(values.goal, 'build trust and generate enquiries');
      const platform = clean(values.platform, 'Instagram and Facebook');
      const rows = [];
      for (let day = 1; day <= 30; day += 1) {
        const [pillar, direction] = pillars[(day - 1) % pillars.length];
        const format = formats[(day * 3 + pillar.length) % formats.length];
        const subject = day % 5 === 0 ? goal : business;
        const hook = hooks[(day - 1) % hooks.length](subject);
        rows.push({ day, pillar, format, hook, direction: `${direction} Tailor it for ${audience} on ${platform}.` });
      }
      const output = $('plannerResults');
      output.innerHTML = rows.map(row => `<div class="planRow"><strong>Day ${row.day}</strong><span>${row.pillar} · ${row.format}</span><span>${row.hook}</span><small>${row.direction}</small></div>`).join('');
      output.dataset.copy = rows.map(row => `Day ${row.day} — ${row.pillar} / ${row.format}\n${row.hook}\n${row.direction}`).join('\n\n');
      $('plannerResultWrap').hidden = false;
      $('plannerResultWrap').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('copyPlan')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText($('plannerResults').dataset.copy || '');
      $('copyPlan').textContent = 'Copied';
    });
  }

  document.querySelectorAll('[data-share-tool]').forEach(button => button.addEventListener('click', async () => {
    const data = { title: document.title, text: 'Try this free social media tool from INXSocial.', url: location.href };
    if (navigator.share) await navigator.share(data); else await navigator.clipboard.writeText(location.href);
  }));
})();

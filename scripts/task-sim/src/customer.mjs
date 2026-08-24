// ── The simulated client ─────────────────────────────────────────────────────
//
// Cooperative, and varied only in HOW they ask and WHAT they ask for — not in
// personality. That is a deliberate correction: adversarial personas find bugs, but they
// find bugs nobody has, and they tell you nothing about whether the ordinary path is
// smooth. The parameters of the ask and the phrasing carry the variation instead.
//
// The persona is given a FACT SHEET of the derived goal and told never to invent a fact
// that isn't on it. That is what keeps ground truth meaningful: if the client says a
// figure we didn't generate, the assertion comparing them is measuring noise.
//
// It is still allowed to behave like a person — to ask what it holds, to answer two
// things at once, to be vague first. A real cooperative customer does all of that, and
// it is exactly how the 36-fund list and the intrusive reason question were found.

const OPENERS = [
  g => `I'd like to ${g.verb} ${g.thing}`,
  g => `Hi, I want to ${g.verb} ${g.thing} please`,
  g => `Can you help me ${g.verb} ${g.thing}?`,
  g => `I need to ${g.verb} ${g.thing}`,
  g => `hi there — looking to ${g.verb} ${g.thing}`,
  g => `Hello! I was hoping to ${g.verb} ${g.thing} today`,
  g => `${g.verb} ${g.thing} — is that something you can do here?`,
  g => `I'd like to ${g.verb} ${g.thing} if that's possible`,
  g => `Quick one: I want to ${g.verb} ${g.thing}`,
  g => `I'm trying to ${g.verb} ${g.thing}`,
];

const ANSWER_STYLES = [
  'Answer in a short, natural sentence.',
  'Answer tersely — a few words is fine.',
  'Answer conversationally, with a little context about why.',
  'Answer, and if it feels natural, volunteer the next detail too.',
];

/** A plain-language phrase for what this task does, from the registry. */
function askPhrase(task, goal) {
  const t = task.id;
  if (/place-purchase/.test(t)) return { verb: 'buy', thing: 'some shares of a fund' };
  if (/place-sale/.test(t)) return { verb: 'sell', thing: 'some shares I hold' };
  if (/exchange/.test(t)) return { verb: 'exchange', thing: 'one fund for another' };
  if (/withdrawal/.test(t)) return { verb: 'take', thing: 'a distribution from my account' };
  if (/beneficiar/.test(t)) return { verb: 'update', thing: 'my beneficiaries' };
  if (/contact/.test(t)) return { verb: 'update', thing: 'my contact information' };
  if (/auto-invest/.test(t)) return { verb: /pause/.test(t) ? 'pause' : 'change', thing: 'my automatic investments' };
  if (/open-account/.test(t)) return { verb: 'open', thing: 'a new account' };
  if (/rollover/.test(t)) return { verb: 'roll over', thing: 'an old retirement account' };
  if (/roth-conversion/.test(t)) return { verb: 'convert', thing: 'some money to my Roth' };
  if (/tax-document/.test(t)) return { verb: 'get', thing: 'a copy of a tax form' };
  if (/callback/.test(t)) return { verb: 'change', thing: 'my scheduled callback' };
  if (/security/.test(t)) return { verb: 'update', thing: 'my account security' };
  if (/drip/.test(t)) return { verb: 'change', thing: 'my dividend reinvestment setting' };
  if (/rmd/.test(t)) return { verb: 'update', thing: 'my RMD settings' };
  if (/access/.test(t)) return { verb: 'give', thing: 'someone access to my account' };
  // Generic fallback, derived from the registry — a future task still gets an opener.
  return { verb: 'sort out', thing: (task.name ?? t).toLowerCase() };
}

export function openingMessage(task, goal, simIndex) {
  const p = askPhrase(task, goal);
  return OPENERS[simIndex % OPENERS.length](p);
}

export function factSheet(goal) {
  const lines = goal.fields.map(f => `  - ${f.label}: ${f.value}`);
  if (goal.account) lines.unshift(`  - Account: ${goal.account.type} (${goal.account.id})`);
  if (goal.position) lines.push(`  - (you hold ${goal.position.shares} shares of ${goal.position.ticker}, worth $${goal.position.value.toLocaleString()})`);
  return lines.join('\n');
}

export function systemPrompt(goal, task, simIndex) {
  const style = ANSWER_STYLES[simIndex % ANSWER_STYLES.length];
  return `You are ${goal.clientName}, a customer of Bob's Mutual Funds, chatting with a service agent.

WHAT YOU WANT: ${task.name.toLowerCase()}.

YOUR FACTS — these are the only specifics you know. Never invent a figure, fund, account,
name or date that is not listed here:
${factSheet(goal)}

HOW TO BEHAVE:
- You are cooperative and you want this done. You are not testing the agent.
- ${style}
- Give the agent what they ask for, drawing ONLY on your facts above.
- If the agent asks for something that is NOT in your facts, say you don't know, or ask
  why they need it. Do not make something up.
- It is fine to ask a natural question of your own — for example what you currently hold,
  or how much is in the account — before answering.
- If the agent proposes something that matches your facts, confirm it.
- Keep replies to one or two sentences. Sound like a real person, not a form.
- Never end the conversation yourself and never say goodbye.`;
}

/** One customer turn. gpt-4o-mini, separate TPM bucket from the experts. */
export async function customerReply({ apiKey, model = 'gpt-4o-mini', system, history, agentMessage }) {
  const messages = [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: `The agent just said: "${agentMessage}"\n\nWhat do you reply?` },
  ];
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: 120, temperature: 0.7 }),
  });
  if (!res.ok) throw new Error(`customer LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

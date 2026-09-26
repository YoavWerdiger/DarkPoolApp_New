# DARKPOOL — CURRENT DESIGN DIRECTION
## Design Brief / Source of Truth

We are refining the DarkPool application into a premium, modern,
consumer-grade financial product.

The current design direction is NOT a traditional trading terminal.

We want to combine:

- Soft UI
- Premium consumer app aesthetics
- Apple-like simplicity
- Modern fintech
- Blink-inspired visual polish
- Dark, warm neutral surfaces
- Spacious layouts
- Strong typography
- Subtle depth
- Minimal visual noise

Think:

"Apple-level restraint + modern fintech + social/trading product."

The goal is for DarkPool to feel like a beautiful consumer application,
not a dashboard template.

==================================================
1. CORE VISUAL CONCEPT
==================================================

The main visual language is:

SOFT UI
+
MODERN CONSUMER APP
+
PREMIUM FINTECH

The interface should feel:

- soft
- calm
- tactile
- premium
- modern
- elegant
- approachable
- highly polished
- effortless

It should NOT feel:

- aggressive
- overly technical
- cyberpunk
- crypto-themed
- neon
- terminal-like
- overly dense
- corporate SaaS
- generic dashboard UI

The user should feel that the application is expensive and carefully
designed without the UI constantly trying to show that it is "fancy."

==================================================
2. PRIMARY BACKGROUND
==================================================

The new primary background is:

#141313

This is a VERY important part of the visual identity.

Do NOT replace it with:

#000000
#0B0C0E
#111111

The background should have a slightly warm, charcoal character.

#141313 should be treated as the canvas.

Everything else should sit subtly above this canvas.

==================================================
3. SURFACE / CARD COLORS
==================================================

Cards should be LIGHTER than the background, but only subtly.

We do NOT want extremely high-contrast white cards.

Suggested hierarchy:

Background:
#141313

Primary surface:
#1B1A1A

Secondary surface:
#201F1F

Elevated surface:
#252424

Hover:
#2A2929

The exact values can be adjusted after visual testing,
but the principle is:

BACKGROUND → DARK WARM CHARCOAL

CARDS → SLIGHTLY LIGHTER WARM GRAY

ELEVATED CARDS → ANOTHER SUBTLE STEP LIGHTER

The difference between surfaces should be felt,
not screamed.

==================================================
4. SOFT UI PRINCIPLE
==================================================

Soft UI does NOT mean everything should have huge shadows.

We want subtle depth.

Depth should primarily come from:

1. surface color
2. spacing
3. radius
4. very subtle shadows
5. subtle borders when necessary

Avoid:

- strong drop shadows
- glowing shadows
- neon outlines
- excessive inner shadows
- glassmorphism
- blur everywhere
- gradients everywhere

The UI should feel soft because of its proportions and surfaces,
not because of visual effects.

==================================================
5. CARD DESIGN
==================================================

Cards are a major part of the design language.

Cards should generally use:

border-radius: 20px–28px

Depending on the component.

Small cards:
16–20px

Standard cards:
20–24px

Large feature cards:
24–28px

Pills:
9999px

Cards should have generous internal padding.

Desktop:

24px–32px

Mobile:

16px–20px

Avoid tiny cards with 8px padding.

The interface should breathe.

==================================================
6. CARD HIERARCHY
==================================================

Not every piece of content needs to be a card.

This is extremely important.

Use cards for:

- market summaries
- important metrics
- featured content
- watchlists
- trading opportunities
- community posts
- important actions

Do NOT put every individual text block inside its own card.

Use:

spacing
typography
dividers
alignment

to create hierarchy.

We want fewer, better cards.

==================================================
7. SPACING SYSTEM
==================================================

Spacing is one of the most important parts of this design.

Use a consistent 4px-based spacing system:

4
8
12
16
20
24
32
40
48
64
80
96

Preferred default spacing:

small gap:
8–12px

normal component gap:
16–20px

card internal gap:
20–24px

section gap:
40–64px

major page sections:
64–96px

Do not compress content just because there is empty space.

Whitespace is intentional.

==================================================
8. PAGE LAYOUT
==================================================

The application should use a strong vertical rhythm.

Typical structure:

Page header
↓
context / short description
↓
primary content
↓
secondary content
↓
supporting content

Do not create a wall of cards.

Use large visual breaks between major sections.

A section should feel like a section.

==================================================
9. CONTAINER WIDTH
==================================================

Use a centered content container.

Preferred:

max-width:
1200–1400px

depending on page.

Do not allow content to stretch indefinitely across huge monitors.

The interface should remain visually controlled.

Desktop side padding:

32–48px

Tablet:

24–32px

Mobile:

16–20px

==================================================
10. GRID SYSTEM
==================================================

Use a flexible grid rather than fixed card widths.

Example:

Main content:
2fr

Secondary:
1fr

Or:

12-column desktop grid.

But do NOT force everything into visible boxes.

Grid should establish alignment.

The user should perceive a clean underlying structure.

==================================================
11. TYPOGRAPHY
==================================================

Typography is one of the PRIMARY design tools.

Prefer:

SF Pro Display
SF Pro Text
Inter
or another extremely clean modern sans-serif.

Typography should feel similar to premium Apple-style consumer apps.

Headlines:

large
bold
tight
confident

Body:

comfortable
clean
slightly muted

Metadata:

small
quiet
secondary

Do NOT make every label uppercase.

Avoid excessive bold text.

Use weight to establish hierarchy.

Suggested hierarchy:

Display:
40–56px

Page title:
32–40px

Section:
22–28px

Card title:
16–20px

Body:
14–16px

Metadata:
12–14px

Small:
11–12px

Mobile typography should scale down intelligently.

==================================================
12. TYPOGRAPHIC HIERARCHY
==================================================

A user should understand a screen by scanning typography.

Example:

MARKET OVERVIEW

NASDAQ
17,862.23
+1.42%

The eye should naturally move:

section → asset → price → movement

Do not make every piece of information equally visually important.

==================================================
13. COLORS / ACCENTS
==================================================

The UI should be primarily monochromatic.

Base:

warm charcoal
warm gray
off-white

Accent colors should be restrained.

Positive:
soft green

Negative:
soft red

Primary interaction:
subtle blue

Example:

Positive:
#6EE7A0

Negative:
#FF7777

Accent:
#7B96F2

These should occupy a SMALL percentage of the UI.

Never turn cards into green/red blocks.

For example:

GOOD:

NVDA
$182.42
+4.82%

where +4.82% is green.

BAD:

Entire card background is bright green.

==================================================
14. SOFT UI COLOR PHILOSOPHY
==================================================

We should use LOW CONTRAST surfaces.

The difference between:

#141313
and
#1B1A1A

should be subtle.

The difference between:

#1B1A1A
and
#201F1F

should also be subtle.

This creates the "soft" feeling.

Avoid extremely bright white surfaces against the dark background.

Primary text can be near-white:

#F4F1ED

Secondary:

#AAA5A0

Muted:

#716D69

==================================================
15. BORDERS
==================================================

Borders should be extremely subtle.

Use them only when they help separation.

Example:

rgba(255,255,255,0.06)

Avoid:

1px bright gray borders everywhere.

If a card can be separated using:

surface contrast + spacing

prefer that over a border.

==================================================
16. SHADOWS
==================================================

Use soft shadows very carefully.

Example philosophy:

0 8px 30px rgba(0,0,0,0.15)

But shadows should not become obvious.

The interface should not look like floating material-design cards.

Depth should remain subtle.

==================================================
17. BUTTONS
==================================================

Buttons should feel tactile and premium.

Primary buttons:

rounded
comfortable
confident
minimal

Use approximately:

height:
44–52px

padding:
16–24px

radius:
14–18px

Avoid tiny buttons.

Avoid giant pill buttons everywhere.

Use pills mainly for:

filters
statuses
segmented controls
compact actions

A primary CTA can be rounded,
but it doesn't need to be a full capsule.

==================================================
18. INPUTS / SEARCH
==================================================

Inputs should feel integrated into the soft surface system.

Example:

background:
#1B1A1A

border:
subtle / optional

radius:
14–18px

height:
44–52px

Placeholder:
muted gray

Focus:
subtle accent

Avoid bright blue focus rings.

==================================================
19. NAVIGATION
==================================================

Navigation should feel like a premium consumer app.

Do not overload the navbar.

The navigation should have:

- clear hierarchy
- generous spacing
- subtle active state
- restrained icons

The active state can use:

slightly lighter surface
+
subtle accent

rather than a bright underline or glowing indicator.

==================================================
20. MOBILE NAVIGATION
==================================================

Mobile is NOT a shrunk desktop version.

Mobile should be intentionally designed.

Use a bottom navigation or similarly accessible structure.

Possible:

Home
Markets
Community
Watchlist
Profile

Icons should be simple.

Labels should be short.

The selected state should be obvious but subtle.

==================================================
21. ICONOGRAPHY
==================================================

Use one icon family consistently.

Prefer:

simple
thin/medium stroke
rounded geometry

Avoid:

random icon styles
emoji
3D icons
filled icons mixed with line icons

Icons should support the interface,
not become decoration.

==================================================
22. MARKET DATA
==================================================

Financial data should be highly legible.

Example:

NASDAQ

17,862.23
+1.42%

The price is the hero.

Ticker/name is secondary.

Percentage is semantic.

Charts should be minimal.

Do not surround every number with a colorful badge.

==================================================
23. CHARTS
==================================================

Charts should visually integrate into the soft UI.

Avoid:

bright chart backgrounds
heavy gridlines
many colors
excessive labels

Use subtle chart lines.

The chart should communicate movement,
not dominate the page.

==================================================
24. COMMUNITY / SOCIAL
==================================================

DarkPool is a financial COMMUNITY.

The social experience should feel like a premium modern consumer product.

Think:

editorial content
+
financial intelligence

A post can have:

author
avatar
timestamp
ticker
headline
short insight
market context
engagement

Do not make it look like Reddit.

Do not make it look like Twitter/X.

Do not make it look like a generic SaaS activity feed.

==================================================
25. CONTENT HIERARCHY
==================================================

Use editorial hierarchy.

For example:

BIG HEADLINE

Short explanation.

Metadata

Supporting information

Action

The UI should communicate what matters without requiring the user
to read every label.

==================================================
26. ANIMATION
==================================================

Animation should be subtle.

Preferred:

150–250ms

Use:

opacity
transform
surface transitions
small scale changes

Examples:

button hover
card hover
tab transition
modal entrance
price update
loading skeleton

Avoid:

bouncy animations
large transforms
particle effects
glowing animations
constant motion

==================================================
27. HOVER STATES
==================================================

Hover states should be subtle.

Example:

#1B1A1A
→
#201F1F

Maybe a tiny translateY(-1px) for interactive cards.

Do not make cards jump dramatically.

==================================================
28. MOBILE TOUCH
==================================================

Interactive elements should generally be at least:

44px

Do not make users tap tiny icons.

Give controls enough breathing room.

==================================================
29. RESPONSIVE BEHAVIOR
==================================================

Desktop:

spacious
multi-column
strong visual hierarchy

Tablet:

reduce columns
preserve spacing

Mobile:

single-column where appropriate
horizontal scrolling for market categories
sticky important controls
simplified navigation
larger touch targets

Do not simply stack everything.

Re-think the hierarchy for mobile.

==================================================
30. WHAT "MODERN" MEANS
==================================================

Modern does NOT mean:

more gradients
more blur
more animation
more glass
more neon
more effects

For this product, modern means:

better proportions
better typography
better spacing
better hierarchy
better surfaces
better interaction
better restraint

==================================================
31. BLINK-INSPIRED DIRECTION
==================================================

Use Blink as inspiration for the FEEL of a modern consumer application:

- extremely polished
- simple
- friendly
- visually confident
- minimal
- highly intentional
- excellent spacing
- strong typography
- clean cards
- easy navigation

Do NOT copy Blink's branding, exact layouts, assets or proprietary visual
elements.

We want the same level of visual polish and simplicity,
translated into DarkPool's own identity.

==================================================
32. APPLE-INSPIRED DIRECTION
==================================================

Take inspiration from Apple's design philosophy:

- hierarchy
- whitespace
- typography
- clarity
- restraint
- tactile controls
- subtle depth
- predictable interaction

Do NOT literally copy Apple's UI.

DarkPool should remain its own product.

==================================================
33. DESIGN TOKENS
==================================================

Create centralized tokens.

Example:

--color-bg: #141313;

--color-surface-1: #1B1A1A;
--color-surface-2: #201F1F;
--color-surface-3: #252424;

--color-text-primary: #F4F1ED;
--color-text-secondary: #AAA5A0;
--color-text-muted: #716D69;

--color-positive: #6EE7A0;
--color-negative: #FF7777;
--color-accent: #7B96F2;

--radius-sm: 12px;
--radius-md: 16px;
--radius-lg: 20px;
--radius-xl: 24px;
--radius-2xl: 28px;
--radius-pill: 9999px;

--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 32px;
--space-8: 40px;
--space-9: 48px;
--space-10: 64px;
--space-11: 80px;
--space-12: 96px;

Adjust values if necessary,
but maintain the system.

==================================================
34. VISUAL RATIO
==================================================

A rough visual distribution should be:

70–80%:
dark neutral surfaces

15–20%:
lighter surfaces / typography

2–5%:
semantic accents

This is a guideline, not a strict mathematical rule.

The UI should visually feel neutral first.

==================================================
35. DESIGN PRINCIPLE
==================================================

The most important principle:

MAKE IT FEEL SIMPLE.

DarkPool may contain complex financial information,
but the interface should not feel complex.

Hide complexity through:

hierarchy
progressive disclosure
spacing
typography
smart defaults
clean navigation

Do not solve complexity by adding more UI.

==================================================
36. QUALITY BAR
==================================================

Before considering a page complete, ask:

Does it look like a premium consumer app?

Does the #141313 background feel intentional?

Are the cards subtly lighter rather than dramatically brighter?

Is the UI soft?

Is there enough whitespace?

Are the typography proportions beautiful?

Are cards too numerous?

Are there unnecessary borders?

Are there too many colors?

Are there too many icons?

Does anything look like a generic dashboard?

Does anything look like a crypto website?

Does anything feel visually noisy?

Does the mobile version feel intentionally designed?

If yes:
keep it.

If no:
simplify it.

==================================================
37. FINAL MENTAL MODEL
==================================================

The target is:

DARKPOOL

A premium financial/social application
with the visual calm of a modern consumer app.

NOT:

A trading terminal with a dark theme.

NOT:

A crypto dashboard.

NOT:

A SaaS template.

NOT:

A neon Web3 interface.

The final feeling should be:

"How is a financial application this clean and easy to use?"

That is the design goal.

==================================================
38. STRICT VISUAL RESTRAINT
==================================================

This is one of the most important rules of the entire design system.

DO NOT use neon.

DO NOT use excessive shadows.

DO NOT use colorful gradients.

DO NOT use multiple accent colors.

DO NOT make the interface visually loud.

The product should feel sophisticated because of:
typography,
spacing,
proportion,
surface hierarchy,
and consistency.

NOT because of effects.

==================================================
39. NO NEON
==================================================

Absolutely avoid:

- neon green
- neon blue
- neon purple
- glowing text
- glowing borders
- glowing buttons
- neon charts
- outer glow effects
- cyberpunk aesthetics

Even positive financial numbers should use a SOFT green,
not a bright neon green.

Example:

GOOD:
#6EE7A0

BAD:
#00FF66

The green should feel refined and muted.

==================================================
40. NO EXCESSIVE SHADOWS
==================================================

Avoid large or obvious shadows.

BAD:

box-shadow:
0 20px 60px rgba(...)

BAD:

strong black shadow around every card

BAD:

multiple shadows stacked together

GOOD:

very subtle depth:

0 8px 30px rgba(0,0,0,0.12)

And only when necessary.

Most cards should rely on:

surface color
+
spacing
+
radius

rather than shadows.

==================================================
41. NO GRADIENT OVERUSE
==================================================

Do not use gradients as a default visual effect.

Avoid:

- gradient backgrounds
- gradient cards
- gradient buttons
- gradient text
- gradient borders

A gradient should only exist if there is a very specific product reason.

Default:
SOLID COLORS.

==================================================
42. TEXT COLOR SYSTEM
==================================================

Text must be extremely restrained.

We want approximately THREE primary text levels.

LEVEL 1 — PRIMARY / HEADLINES

Color:

#F4F1ED

Use for:

- page titles
- major headings
- important numbers
- primary labels
- important navigation

This is the dominant text color.

------------------------------------------

LEVEL 2 — SECONDARY / SUBHEADINGS

Color:

#AAA5A0

Use for:

- subtitles
- descriptions
- secondary navigation
- supporting labels
- metadata
- explanations

This should be clearly quieter than the primary text.

------------------------------------------

LEVEL 3 — MUTED / SUPPORTING

Color:

#716D69

Use sparingly for:

- timestamps
- tertiary metadata
- placeholders
- very low-priority information

Do NOT create 7 different shades of gray.

The typography system should feel simple.

==================================================
43. TEXT COLOR RULE
==================================================

IMPORTANT:

Do NOT randomly color text.

Most text should be:

white / warm-white
or
gray.

Do not use blue text everywhere.

Do not use green text unless the content is semantically positive.

Do not use red text unless the content is semantically negative.

Do not use orange text unless the content is genuinely an alert/warning.

For example:

GOOD:

Market Overview
#F4F1ED

Track your market in one place.
#AAA5A0

Updated 2 minutes ago
#716D69


BAD:

Market Overview → blue
Track your market → purple
Updated → orange

This creates visual noise.

==================================================
44. HEADLINE COLOR
==================================================

Main headings should almost always be:

#F4F1ED

No gradients.

No colored headlines.

No blue headlines.

No green headlines.

No gradient text.

The typography itself should provide hierarchy.

==================================================
45. SUBHEADING COLOR
==================================================

Subheadings should generally be:

#AAA5A0

They should feel softer than the headline,
but still readable.

Example:

MARKET OVERVIEW
white

Track what is happening across the market.
gray

==================================================
46. CONTENT COLOR
==================================================

Normal body content:

#F4F1ED

Secondary body content:

#AAA5A0

Muted information:

#716D69

Use color primarily to communicate semantic information,
not to decorate text.

==================================================
47. FINANCIAL SEMANTIC COLORS
==================================================

Financial colors are exceptions to the monochrome text system.

Positive:

#6EE7A0

Negative:

#FF7777

Warning:

#E8B56A

But use them ONLY where they communicate meaning.

Examples:

+4.82% → green

-2.14% → red

Warning → orange

Do not use these colors for random UI labels.

==================================================
48. COLOR HIERARCHY
==================================================

The user should perceive the application approximately as:

1. Warm white typography
2. Warm gray typography
3. Dark neutral surfaces
4. Very subtle borders
5. Small semantic accents

NOT:

1. Colors
2. Gradients
3. Glows
4. Shadows
5. Everything else

Color is supporting the information hierarchy.

It is not the hierarchy itself.

==================================================
49. NO VISUAL COMPETITION
==================================================

Only ONE element should feel visually dominant in a section.

For example:

PAGE:

Market Overview ← dominant

NASDAQ
17,862.23
+1.42%

The title should not compete with:
buttons,
icons,
badges,
charts,
colored backgrounds.

If everything is emphasized,
nothing is emphasized.

==================================================
50. TYPOGRAPHY BEFORE COLOR
==================================================

When you need to make something more important:

FIRST:
increase size

SECOND:
increase weight

THIRD:
increase spacing

FOURTH:
change surface

ONLY LAST:
use color

Do not solve hierarchy problems by adding color.

==================================================
51. CARD CONTENT
==================================================

A typical card should look approximately like:

[ small contextual label ]

NASDAQ

17,862.23

+1.42%

Small chart

Where:

NASDAQ:
secondary / white

17,862.23:
primary / large / white

+1.42%:
soft green

Chart:
subtle

The card itself:
dark neutral surface

There should NOT be:

blue title
purple chart
green background
glowing border
bright shadow

==================================================
52. BUTTON COLOR SYSTEM
==================================================

Buttons should also remain restrained.

Primary button:

warm white / off-white surface
dark text

Secondary button:

dark elevated surface
light text

Tertiary:

transparent
secondary text

Accent blue can be used for specific interactive states,
but should not dominate the application.

Avoid making every CTA blue.

==================================================
53. ACTIVE STATES
==================================================

Active states should be communicated primarily through:

surface change
typography
small indicator
subtle border

NOT:

bright colored backgrounds.

Example:

inactive:
#141313

active:
#201F1F

with subtle white text emphasis.

==================================================
54. ICON COLOR
==================================================

Icons should generally inherit the text hierarchy.

Primary icon:
#F4F1ED

Secondary icon:
#AAA5A0

Muted icon:
#716D69

Do not give every icon a different color.

Semantic icons can use semantic colors.

==================================================
55. BORDER COLOR
==================================================

Default border:

rgba(255,255,255,0.05–0.07)

Borders should be barely noticeable.

If the user immediately notices the border,
it is probably too strong.

==================================================
56. VISUAL NOISE TEST
==================================================

After implementing each screen:

Temporarily imagine all colors removed.

Ask:

Does the hierarchy still work?

If YES:
the design is strong.

If NO:
we are relying too much on color.

The product should remain understandable
even with a nearly monochromatic palette.

==================================================
57. THE "APPLE TEST"
==================================================

Before adding ANY visual effect, ask:

Would a premium Apple-style consumer application
actually need this effect?

If the answer is no:

DO NOT ADD IT.

This applies to:

- gradients
- glows
- excessive shadows
- decorative borders
- animated backgrounds
- particles
- colorful badges
- excessive blur
- oversized icons

==================================================
58. THE "ONE ACCENT" RULE
==================================================

A screen should generally have ONE visual accent.

For example:

Neutral interface
+
subtle blue interaction

OR

Neutral interface
+
green positive financial movement

Not:

blue + purple + orange + pink + green.

The interface should feel cohesive.

==================================================
59. FINAL COLOR PHILOSOPHY
==================================================

DarkPool should feel like:

WARM DARK NEUTRALS
+
WHITE TYPOGRAPHY
+
GRAY SUPPORTING TEXT
+
SMALL SEMANTIC ACCENTS

Nothing more is required.

The beauty should come from:

spacing
typography
geometry
proportion
surface hierarchy
interaction design

NOT decoration.

==================================================
60. FINAL RULE
==================================================

When deciding between:

A) adding another visual effect

or

B) improving spacing / typography / hierarchy

ALWAYS choose B.

When deciding between:

A) another color

or

B) stronger contrast through surface and typography

ALWAYS choose B.

When deciding between:

A) a stronger shadow

or

B) a better surface hierarchy

ALWAYS choose B.

The design should be restrained by default.

If something can be removed without hurting usability,
remove it.
